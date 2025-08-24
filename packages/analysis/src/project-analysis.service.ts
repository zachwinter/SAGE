import { GraphQueryEngine, AGENT_QUERIES } from "./graph/query.js";
import { findProjectRoot, getProjectMetadata, getProjectGraphDbPath, graphs } from "./utils/directories.js";
import { existsSync, statSync, readFileSync, writeFileSync } from "fs";
import { join, basename } from "path";
import { createHash } from "crypto";
import Logger from "./utils/logger.js";
import { getCodeFiles } from "./index.js";

export interface ProjectAnalysisState {
  isAnalyzed: boolean;
  projectRoot: string | null;
  dbPath: string | null;
  metadata: ReturnType<typeof getProjectMetadata> | null;
  graphEngine: GraphQueryEngine | null;
}

export interface AnalysisCacheMetadata {
  projectRoot: string;
  lastAnalysis: number;
  fileCount: number;
  packageJsonHash: string;
  sourceFileMtimes: Record<string, number>;
}

class ProjectAnalysisService {
  private state: ProjectAnalysisState = {
    isAnalyzed: false,
    projectRoot: null,
    dbPath: null,
    metadata: null,
    graphEngine: null
  };

  /**
   * Get cache metadata file path for a project
   */
  private getCacheMetadataPath(projectRoot: string): string {
    const projectHash = createHash('md5').update(projectRoot).digest('hex').substring(0, 8);
    return join(graphs, `${basename(projectRoot)}-${projectHash}.metadata.json`);
  }

  /**
   * Check if re-analysis is needed based on file modifications
   */
  private async isReanalysisNeeded(projectRoot: string): Promise<boolean> {
    const cacheFile = this.getCacheMetadataPath(projectRoot);
    const dbPath = getProjectGraphDbPath(projectRoot);
    
    // If no database exists, analysis is needed
    if (!existsSync(dbPath)) {
      Logger.info("No cached analysis found - full analysis needed");
      return true;
    }

    // If no metadata cache exists, analysis is needed
    if (!existsSync(cacheFile)) {
      Logger.info("No analysis metadata found - full analysis needed");
      return true;
    }

    try {
      const cachedMetadata: AnalysisCacheMetadata = JSON.parse(readFileSync(cacheFile, 'utf8'));
      
      // Get current project files
      const currentFiles = getCodeFiles(projectRoot);
      
      // Check if file count changed
      if (currentFiles.length !== cachedMetadata.fileCount) {
        Logger.info(`File count changed (${cachedMetadata.fileCount} → ${currentFiles.length}) - analysis needed`);
        return true;
      }

      // Check package.json changes
      const packageJsonPath = join(projectRoot, 'package.json');
      if (existsSync(packageJsonPath)) {
        const currentPackageHash = createHash('md5')
          .update(readFileSync(packageJsonPath, 'utf8'))
          .digest('hex');
        
        if (currentPackageHash !== cachedMetadata.packageJsonHash) {
          Logger.info("package.json changed - analysis needed");
          return true;
        }
      }

      // Check if any source files have been modified
      let modifiedFiles = 0;
      for (const file of currentFiles.slice(0, 50)) { // Check first 50 files for performance
        try {
          const stat = statSync(file);
          const currentMtime = stat.mtime.getTime();
          const cachedMtime = cachedMetadata.sourceFileMtimes[file];
          
          if (!cachedMtime || currentMtime > cachedMtime) {
            modifiedFiles++;
          }
        } catch (error) {
          // File might have been deleted, consider it modified
          modifiedFiles++;
        }
      }

      if (modifiedFiles > 0) {
        Logger.info(`${modifiedFiles} files modified - analysis needed`);
        return true;
      }

      Logger.info("No significant changes detected - using cached analysis");
      return false;

    } catch (error) {
      Logger.warn("Failed to read cache metadata - full analysis needed", error as Error);
      return true;
    }
  }

  /**
   * Save cache metadata after successful analysis
   */
  private async saveCacheMetadata(projectRoot: string): Promise<void> {
    try {
      const cacheFile = this.getCacheMetadataPath(projectRoot);
      const currentFiles = getCodeFiles(projectRoot);
      
      // Build file modification times map
      const sourceFileMtimes: Record<string, number> = {};
      for (const file of currentFiles) {
        try {
          const stat = statSync(file);
          sourceFileMtimes[file] = stat.mtime.getTime();
        } catch (error) {
          // Skip files that can't be stat'd
        }
      }

      // Get package.json hash
      let packageJsonHash = '';
      const packageJsonPath = join(projectRoot, 'package.json');
      if (existsSync(packageJsonPath)) {
        packageJsonHash = createHash('md5')
          .update(readFileSync(packageJsonPath, 'utf8'))
          .digest('hex');
      }

      const metadata: AnalysisCacheMetadata = {
        projectRoot,
        lastAnalysis: Date.now(),
        fileCount: currentFiles.length,
        packageJsonHash,
        sourceFileMtimes
      };

      writeFileSync(cacheFile, JSON.stringify(metadata, null, 2));
      Logger.debug(`Cache metadata saved to ${cacheFile}`);
    } catch (error) {
      Logger.warn("Failed to save cache metadata", error as Error);
    }
  }

  /**
   * Initialize project analysis during CLI startup
   */
  async initializeForProject(startPath?: string): Promise<boolean> {
    try {
      Logger.info("Initializing project analysis...");
      
      // Find project root
      const projectRoot = findProjectRoot(startPath);
      if (!projectRoot) {
        Logger.info("No project root found (no package.json detected). Skipping analysis.");
        return false;
      }

      this.state.projectRoot = projectRoot;
      this.state.dbPath = getProjectGraphDbPath(projectRoot);
      this.state.metadata = getProjectMetadata(projectRoot);
      
      Logger.info(`Project detected: ${this.state.metadata.name} at ${projectRoot}`);

      // Check if re-analysis is needed
      const needsAnalysis = await this.isReanalysisNeeded(projectRoot);
      
      // Initialize graph engine
      this.state.graphEngine = new GraphQueryEngine(projectRoot);
      
      if (needsAnalysis) {
        Logger.info("Running project analysis...");
        await this.state.graphEngine.ensureReady();
        
        // Save cache metadata after successful analysis
        await this.saveCacheMetadata(projectRoot);
      } else {
        // Just initialize the engine with existing data
        await this.state.graphEngine.ensureReady();
      }

      this.state.isAnalyzed = true;
      
      // Log analysis completion
      const entityCount = await this.getEntityCount();
      Logger.info(`Project analysis ready. Found ${entityCount} code entities.`);
      
      return true;
    } catch (error) {
      Logger.error("Failed to initialize project analysis", error as Error);
      return false;
    }
  }

  /**
   * Get current project analysis state
   */
  getAnalysisState(): ProjectAnalysisState {
    return { ...this.state };
  }

  /**
   * Check if project analysis is ready
   */
  isReady(): boolean {
    return this.state.isAnalyzed && this.state.graphEngine !== null;
  }

  /**
   * Execute a graph query
   */
  async query(cypher: string) {
    if (!this.state.graphEngine) {
      throw new Error("Project analysis not initialized. Call initializeForProject() first.");
    }
    return await this.state.graphEngine.query(cypher);
  }

  /**
   * Run a predefined agent query
   */
  async runAgentQuery(queryName: keyof typeof AGENT_QUERIES) {
    const cypher = AGENT_QUERIES[queryName];
    if (!cypher) {
      throw new Error(`Unknown agent query: ${queryName}`);
    }
    return await this.query(cypher);
  }

  /**
   * Get count of entities in the graph
   */
  private async getEntityCount(): Promise<number> {
    try {
      if (!this.state.graphEngine) return 0;
      const result = await this.state.graphEngine.query("MATCH (n:CodeEntity) RETURN count(n) as count");
      return result.rows[0]?.count || 0;
    } catch (error) {
      Logger.warn("Failed to get entity count", error as Error);
      return 0;
    }
  }

  /**
   * Get project insights for agents
   */
  async getProjectInsights() {
    if (!this.isReady()) {
      return null;
    }

    const insights = {
      project: this.state.metadata,
      summary: {
        entityCount: await this.getEntityCount()
      }
    };

    try {
      // Get some basic metrics
      const [securityIssues, publicApi, testCoverage] = await Promise.all([
        this.runAgentQuery("securitySensitive").catch(() => ({ rows: [] })),
        this.runAgentQuery("publicApi").catch(() => ({ rows: [] })),
        this.runAgentQuery("testCases").catch(() => ({ rows: [] }))
      ]);

      return {
        ...insights,
        summary: {
          ...insights.summary,
          securitySensitiveFunctions: securityIssues.rows.length,
          publicApiFunctions: publicApi.rows.length,
          testCases: testCoverage.rows.length
        }
      };
    } catch (error) {
      Logger.warn("Failed to gather project insights", error as Error);
      return insights;
    }
  }

  /**
   * Reset analysis state (useful for testing or re-analysis)
   */
  reset() {
    this.state = {
      isAnalyzed: false,
      projectRoot: null,
      dbPath: null,
      metadata: null,
      graphEngine: null
    };
  }
}

// Export singleton instance
export const projectAnalysisService = new ProjectAnalysisService();