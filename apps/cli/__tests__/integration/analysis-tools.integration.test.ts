import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  analyzeFiles,
  getCodeFiles,
  performCallTreeAnalysis,
  performTypeAnalysis
} from "@sage/analysis";
import { Read } from "@/tools/Read";
import { Write } from "@/tools/Write";
import { Edit } from "@/tools/Edit";
import { Bash } from "@/tools/Bash";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Analysis Engine + Tools Integration Tests", () => {
  let tempDir: string;
  let projectDir: string;
  let srcDir: string;

  beforeAll(() => {
    // Create a temporary directory for our tests
    tempDir = join(tmpdir(), `analysis-tools-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    projectDir = join(tempDir, "test-project");
    srcDir = join(projectDir, "src");
    mkdirSync(srcDir, { recursive: true });
  });

  afterAll(() => {
    // Cleanup temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clean up project directory before each test
    if (existsSync(projectDir)) {
      rmSync(projectDir, { recursive: true });
    }
    mkdirSync(srcDir, { recursive: true });
  });

  describe("File Discovery + Tools Integration", () => {
    it("should discover files created by Write tool and analyze them", async () => {
      // Create TypeScript files using Write tool
      const tsFiles = [
        {
          path: join(srcDir, "utils.ts"),
          content: `export function formatString(input: string): string {
  return input.trim().toLowerCase();
}

export class StringProcessor {
  private readonly prefix: string;
  
  constructor(prefix: string) {
    this.prefix = prefix;
  }
  
  process(input: string): string {
    return this.prefix + formatString(input);
  }
}`
        },
        {
          path: join(srcDir, "index.ts"),
          content: `import { formatString, StringProcessor } from './utils.js';

function main() {
  const processor = new StringProcessor('[MAIN] ');
  const result = processor.process('Hello World');
  console.log(result);
}

export { main };`
        }
      ];

      // Write files using Write tool
      for (const file of tsFiles) {
        const writeResult = await Write.implementation({
          file_path: file.path,
          content: file.content
        });
        expect(writeResult).toEqual({
          success: true,
          message: expect.stringContaining("Successfully wrote to")
        });
      }

      // Discover files using analysis engine
      const discoveredFiles = getCodeFiles(projectDir);
      expect(discoveredFiles).toHaveLength(2);
      expect(discoveredFiles.some(f => f.includes("utils.ts"))).toBe(true);
      expect(discoveredFiles.some(f => f.includes("index.ts"))).toBe(true);

      // Analyze discovered files
      const analysisResults = analyzeFiles(discoveredFiles);
      expect(analysisResults).toHaveLength(2);

      // Verify analysis found expected entities
      const allEntities = analysisResults.flatMap(r => r.entities);
      const entityNames = allEntities.map(e => e.name);

      expect(entityNames).toContain("formatString");
      expect(entityNames).toContain("StringProcessor");
      expect(entityNames).toContain("main");
    });

    it("should analyze code files and generate reports using tools", async () => {
      // Create a complex TypeScript project structure
      const projectStructure = [
        {
          path: join(srcDir, "models", "user.ts"),
          content: `export interface User {
  id: string;
  name: string;
  email: string;
}

export class UserService {
  private users: User[] = [];
  
  async createUser(userData: Partial<User>): Promise<User> {
    const user: User = {
      id: Math.random().toString(),
      name: userData.name || '',
      email: userData.email || ''
    };
    this.users.push(user);
    return user;
  }
  
  async getUser(id: string): Promise<User | null> {
    return this.users.find(u => u.id === id) || null;
  }
}`
        },
        {
          path: join(srcDir, "services", "api.ts"),
          content: `import { User, UserService } from '../models/user.js';

export class ApiService {
  private userService = new UserService();
  
  async handleUserRequest(data: any): Promise<any> {
    if (data.action === 'create') {
      return await this.userService.createUser(data.user);
    } else if (data.action === 'get') {
      return await this.userService.getUser(data.id);
    }
    throw new Error('Unknown action');
  }
}`
        },
        {
          path: join(srcDir, "app.ts"),
          content: `import { ApiService } from './services/api.js';

const apiService = new ApiService();

async function startApp() {
  console.log('Application starting...');
  
  // Create test user
  const user = await apiService.handleUserRequest({
    action: 'create',
    user: { name: 'Test User', email: 'test@example.com' }
  });
  
  console.log('Created user:', user);
}

startApp().catch(console.error);`
        }
      ];

      // Create directory structure with Bash
      await Bash.implementation({
        command: `mkdir -p "${join(srcDir, "models")}" "${join(srcDir, "services")}"`
      });

      // Write all files using Write tool
      for (const file of projectStructure) {
        await Write.implementation({
          file_path: file.path,
          content: file.content
        });
      }

      // Discover and analyze files
      const codeFiles = getCodeFiles(projectDir);
      expect(codeFiles).toHaveLength(3);

      const analysisResults = analyzeFiles(codeFiles);
      expect(analysisResults).toHaveLength(3);

      // Generate analysis report using Write tool
      const reportData = {
        timestamp: new Date().toISOString(),
        totalFiles: analysisResults.length,
        totalEntities: analysisResults.reduce(
          (sum, r) => sum + r.entities.length,
          0
        ),
        entitiesByType: {},
        files: analysisResults.map(r => ({
          path: r.filePath,
          entities: r.entities.length,
          totalLines: r.totalLines
        }))
      };

      // Count entities by type
      for (const result of analysisResults) {
        for (const entity of result.entities) {
          const type = entity.type;
          (reportData.entitiesByType as any)[type] =
            ((reportData.entitiesByType as any)[type] || 0) + 1;
        }
      }

      const reportPath = join(projectDir, "analysis-report.json");
      await Write.implementation({
        file_path: reportPath,
        content: JSON.stringify(reportData, null, 2)
      });

      // Verify report was created
      const { success, message } = await Read.implementation({
        file_path: reportPath
      });

      expect(success).toBe(true);

      const parsedReport = JSON.parse(message);
      expect(parsedReport.totalFiles).toBe(3);
      expect(parsedReport.totalEntities).toBeGreaterThan(5);
      expect(parsedReport.entitiesByType).toHaveProperty("class");
      expect(parsedReport.entitiesByType).toHaveProperty("function");
    });
  });

  describe("Code Analysis + Edit Integration", () => {
    it("should analyze code, identify patterns, and apply automated edits", async () => {
      // Create code with patterns that need fixing
      const codeWithIssues = `export function processData(data: any): any {
  // TODO: Add proper type annotations
  const result = data.map((item: any) => {
    return item.value * 2;
  });
  return result;
}

export function calculateSum(numbers: any[]): any {
  // TODO: Add proper type annotations
  let sum = 0;
  for (const num of numbers) {
    sum += num;
  }
  return sum;
}

export function formatOutput(data: any): string {
  // TODO: Add proper type annotations
  return JSON.stringify(data);
}`;

      const codeFile = join(srcDir, "needs-fixing.ts");
      await Write.implementation({
        file_path: codeFile,
        content: codeWithIssues
      });

      // Analyze the code
      const analysisResults = analyzeFiles([codeFile]);
      expect(analysisResults).toHaveLength(1);

      const result = analysisResults[0];
      const functions = result.entities.filter(e => e.type === "function");
      expect(functions).toHaveLength(3);

      // Read current content
      const currentContent = await Read.implementation({
        file_path: codeFile
      });

      // Apply automated fixes using Edit tool
      const fixes = [
        {
          old: "processData(data: any): any",
          new: "processData(data: Array<{value: number}>): number[]"
        },
        {
          old: "calculateSum(numbers: any[]): any",
          new: "calculateSum(numbers: number[]): number"
        },
        {
          old: "formatOutput(data: any): string",
          new: "formatOutput(data: unknown): string"
        }
      ];

      for (const fix of fixes) {
        await Edit.implementation({
          file_path: codeFile,
          old_string: fix.old,
          new_string: fix.new
        });
      }

      // Remove TODO comments
      await Edit.implementation({
        file_path: codeFile,
        old_string: "  // TODO: Add proper type annotations\n",
        new_string: "",
        replace_all: true
      });

      // Verify fixes were applied
      const { success, message: fixedContent } = await Read.implementation({
        file_path: codeFile
      });

      expect(success).toBe(true);
      expect(fixedContent).toContain(
        "processData(data: Array<{value: number}>): number[]"
      );
      expect(fixedContent).toContain("calculateSum(numbers: number[]): number");
      expect(fixedContent).toContain("formatOutput(data: unknown): string");
      expect(fixedContent).not.toContain("TODO");

      // Re-analyze to verify improvements
      const fixedAnalysisResults = analyzeFiles([codeFile]);
      expect(fixedAnalysisResults[0].entities).toHaveLength(6);
    });

    it("should perform call tree analysis and generate documentation", async () => {
      // Create interconnected code files
      const utilsFile = join(srcDir, "utils.ts");
      const utilsContent = `export function logMessage(message: string): void {
  console.log(\`[\${new Date().toISOString()}] \${message}\`);
}

export function validateInput(input: string): boolean {
  logMessage(\`Validating input: \${input}\`);
  return input.length > 0;
}

export function processInput(input: string): string {
  if (!validateInput(input)) {
    logMessage('Invalid input provided');
    throw new Error('Invalid input');
  }
  logMessage('Processing valid input');
  return input.toUpperCase();
}`;

      const mainFile = join(srcDir, "main.ts");
      const mainContent = `import { processInput, logMessage } from './utils.js';

export function handleUserInput(userInput: string): string {
  logMessage('Starting to handle user input');
  try {
    const result = processInput(userInput);
    logMessage('Successfully processed user input');
    return result;
  } catch (error) {
    logMessage('Error processing user input');
    throw error;
  }
}

export function runApplication(): void {
  logMessage('Application started');
  const testInput = 'hello world';
  const result = handleUserInput(testInput);
  logMessage(\`Result: \${result}\`);
  logMessage('Application finished');
}`;

      // Write files
      await Write.implementation({ file_path: utilsFile, content: utilsContent });
      await Write.implementation({ file_path: mainFile, content: mainContent });

      // Analyze files
      const files = [utilsFile, mainFile];
      const analysisResults = analyzeFiles(files);

      // Perform call tree analysis
      const callTreeResult = performCallTreeAnalysis(analysisResults);
      expect(callTreeResult).toBeDefined();
      expect(callTreeResult.allFunctions).toBeDefined();

      // Generate documentation from call tree
      const docContent = `# Call Tree Analysis Report

## Functions Analyzed
${Array.from(callTreeResult.allFunctions)
  .map(funcId => {
    const calls = Array.from(callTreeResult.callGraph.get(funcId) || []);
    const calledBy = Array.from(callTreeResult.reverseCallGraph.get(funcId) || []);
    return `
### ${funcId}
- **Calls**: ${calls.length > 0 ? calls.join(", ") : "None"}
- **Called by**: ${calledBy.length > 0 ? calledBy.join(", ") : "None"}
`;
  })
  .join("")}

## Analysis Summary
- Total functions: ${callTreeResult.allFunctions.size}
- Generated: ${new Date().toISOString()}
`;

      const docPath = join(projectDir, "CALL_TREE.md");
      await Write.implementation({
        file_path: docPath,
        content: docContent
      });

      // Verify documentation was created
      const { success, message: docResult } = await Read.implementation({
        file_path: docPath
      });
      expect(success).toBe(true);
      expect(docResult).toContain("# Call Tree Analysis Report");
      expect(docResult).toContain("logMessage");
      expect(docResult).toContain("processInput");
      expect(docResult).toContain("handleUserInput");
    });
  });

  describe("Large Codebase Analysis + Tools", () => {
    it("should analyze large codebase and generate summary reports", async () => {
      // Generate a larger codebase structure
      const modules = [
        { name: "auth", files: ["user.ts", "session.ts", "middleware.ts"] },
        { name: "data", files: ["models.ts", "repository.ts", "validation.ts"] },
        { name: "api", files: ["routes.ts", "controllers.ts", "middleware.ts"] },
        { name: "utils", files: ["helpers.ts", "formatters.ts", "validators.ts"] }
      ];

      // Create directory structure
      for (const module of modules) {
        const moduleDir = join(srcDir, module.name);
        await Bash.implementation({
          command: `mkdir -p "${moduleDir}"`
        });

        // Generate files for each module
        for (const fileName of module.files) {
          const content = `// ${module.name}/${fileName}
export interface ${fileName.replace(".ts", "").charAt(0).toUpperCase() + fileName.slice(1, -3)}Config {
  enabled: boolean;
  options: Record<string, any>;
}

export class ${fileName.replace(".ts", "").charAt(0).toUpperCase() + fileName.slice(1, -3)}Service {
  private config: ${fileName.replace(".ts", "").charAt(0).toUpperCase() + fileName.slice(1, -3)}Config;
  
  constructor(config: ${fileName.replace(".ts", "").charAt(0).toUpperCase() + fileName.slice(1, -3)}Config) {
    this.config = config;
  }
  
  async process(data: any): Promise<any> {
    if (!this.config.enabled) {
      throw new Error('Service not enabled');
    }
    return this.processInternal(data);
  }
  
  private async processInternal(data: any): Promise<any> {
    // Implementation would go here
    return data;
  }
  
  getConfig(): ${fileName.replace(".ts", "").charAt(0).toUpperCase() + fileName.slice(1, -3)}Config {
    return this.config;
  }
}

export function create${fileName.replace(".ts", "").charAt(0).toUpperCase() + fileName.slice(1, -3)}(config: Partial<${fileName.replace(".ts", "").charAt(0).toUpperCase() + fileName.slice(1, -3)}Config>): ${fileName.replace(".ts", "").charAt(0).toUpperCase() + fileName.slice(1, -3)}Service {
  const defaultConfig: ${fileName.replace(".ts", "").charAt(0).toUpperCase() + fileName.slice(1, -3)}Config = {
    enabled: true,
    options: {}
  };
  return new ${fileName.replace(".ts", "").charAt(0).toUpperCase() + fileName.slice(1, -3)}Service({ ...defaultConfig, ...config });
}`;

          await Write.implementation({
            file_path: join(srcDir, module.name, fileName),
            content
          });
        }
      }

      // Discover all files
      const allFiles = getCodeFiles(projectDir);
      expect(allFiles.length).toBe(12); // 4 modules × 3 files each

      // Analyze all files
      const analysisResults = analyzeFiles(allFiles);
      expect(analysisResults.length).toBe(12);

      // Generate comprehensive summary
      const summary = {
        timestamp: new Date().toISOString(),
        totalFiles: analysisResults.length,
        totalLines: analysisResults.reduce((sum, r) => sum + r.totalLines, 0),
        totalEntities: analysisResults.reduce(
          (sum, r) => sum + r.entities.length,
          0
        ),
        moduleBreakdown: {} as Record<string, any>,
        entityTypes: {} as Record<string, number>
      };

      // Analyze by module
      for (const module of modules) {
        const moduleFiles = analysisResults.filter(r =>
          r.filePath.includes(module.name)
        );
        summary.moduleBreakdown[module.name] = {
          files: moduleFiles.length,
          entities: moduleFiles.reduce((sum, f) => sum + f.entities.length, 0),
          lines: moduleFiles.reduce((sum, f) => sum + f.totalLines, 0)
        };
      }

      // Count entity types
      for (const result of analysisResults) {
        for (const entity of result.entities) {
          summary.entityTypes[entity.type] =
            (summary.entityTypes[entity.type] || 0) + 1;
        }
      }

      // Write summary report
      const summaryPath = join(projectDir, "codebase-summary.json");
      await Write.implementation({
        file_path: summaryPath,
        content: JSON.stringify(summary, null, 2)
      });

      // Generate markdown report
      const markdownReport = `# Codebase Analysis Summary

Generated: ${summary.timestamp}

## Overview
- **Total Files**: ${summary.totalFiles}
- **Total Lines**: ${summary.totalLines}
- **Total Entities**: ${summary.totalEntities}

## Module Breakdown
${Object.entries(summary.moduleBreakdown)
  .map(
    ([moduleName, data]: [string, any]) => `
### ${moduleName}
- Files: ${data.files}
- Entities: ${data.entities}
- Lines: ${data.lines}
`
  )
  .join("")}

## Entity Types
${Object.entries(summary.entityTypes)
  .map(([type, count]) => `- **${type}**: ${count}`)
  .join("\n")}

## Files Analyzed
${analysisResults.map(r => `- ${r.filePath} (${r.entities.length} entities, ${r.totalLines} lines)`).join("\n")}
`;

      const markdownPath = join(projectDir, "ANALYSIS.md");
      await Write.implementation({
        file_path: markdownPath,
        content: markdownReport
      });

      // Verify reports
      const { message: summaryContent } = await Read.implementation({
        file_path: summaryPath
      });
      const { message: markdownContent } = await Read.implementation({
        file_path: markdownPath
      });

      const parsedSummary = JSON.parse(summaryContent as string);
      expect(parsedSummary.totalFiles).toBe(12);
      expect(parsedSummary.moduleBreakdown).toHaveProperty("auth");
      expect(parsedSummary.moduleBreakdown).toHaveProperty("data");
      expect(parsedSummary.entityTypes).toHaveProperty("class");
      expect(parsedSummary.entityTypes).toHaveProperty("interface");

      expect(markdownContent).toContain("# Codebase Analysis Summary");
      expect(markdownContent).toContain("## Module Breakdown");
      expect(markdownContent).toContain("### auth");
    });

    it("should perform type analysis and generate type documentation", async () => {
      // Create TypeScript files with complex type relationships
      const typesFile = join(srcDir, "types.ts");
      const typesContent = `export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User extends BaseEntity {
  name: string;
  email: string;
  roles: Role[];
}

export interface Role extends BaseEntity {
  name: string;
  permissions: Permission[];
}

export interface Permission extends BaseEntity {
  resource: string;
  action: string;
}

export type UserWithRoles = User & {
  roleNames: string[];
};

export type CreateUserRequest = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  errors?: string[];
}`;

      await Write.implementation({
        file_path: typesFile,
        content: typesContent
      });

      // Analyze types
      const analysisResults = analyzeFiles([typesFile], { types: true });
      const typeAnalysisResult = performTypeAnalysis(analysisResults);

      expect(typeAnalysisResult).toBeDefined();
      expect(typeAnalysisResult.allTypes.size).toBeGreaterThan(0);
      expect(typeAnalysisResult.typeRelationships).toBeDefined();

      // Generate type documentation
      const allTypesArray = Array.from(typeAnalysisResult.allTypes.values());
      const interfaces = allTypesArray.filter(type => type.kind === "interface");
      const typeAliases = allTypesArray.filter(type => type.kind === "type");

      const typeDoc = `# Type System Documentation

## Interfaces
${interfaces
  .map(
    iface => `
### ${iface.name}
- **File**: ${iface.filePath}
- **Line**: ${iface.line}
`
  )
  .join("")}

## Type Aliases
${typeAliases
  .map(
    type => `
### ${type.name}
- **File**: ${type.filePath}
- **Line**: ${type.line}
`
  )
  .join("")}

Generated: ${new Date().toISOString()}
`;

      const typeDocPath = join(projectDir, "TYPES.md");
      await Write.implementation({
        file_path: typeDocPath,
        content: typeDoc
      });

      const { success, message } = await Read.implementation({
        file_path: typeDocPath
      });
      expect(success).toBe(true);
      expect(message).toContain("# Type System Documentation");
      expect(message).toContain("BaseEntity");
      expect(message).toContain("User");
      expect(message).toContain("ApiResponse");
    });
  });
});
