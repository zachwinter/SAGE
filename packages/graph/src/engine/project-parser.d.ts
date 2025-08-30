import type { GraphEntity } from "../types.js";
export interface ProjectInfo {
    name: string;
    version: string;
    description?: string;
    license?: string;
    repository?: string;
    homepage?: string;
    workspaces?: string[];
    isMonorepo: boolean;
}
export interface ApplicationInfo {
    name: string;
    type: "cli" | "library" | "service" | "webapp" | "package";
    packageName: string;
    main?: string;
    types?: string;
    bin?: Record<string, string>;
    entryPoints: string[];
    packagePath: string;
}
export interface PackageInfo {
    name: string;
    version: string;
    description?: string;
    main?: string;
    types?: string;
    license?: string;
    bin?: Record<string, string>;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    engines?: Record<string, string>;
    packagePath: string;
}
/**
 * Parse root package.json and determine project structure
 */
export declare function parseProjectInfo(projectRoot: string): ProjectInfo | null;
/**
 * Find all packages in the project (including workspace packages)
 */
export declare function findPackages(projectInfo: ProjectInfo, projectRoot: string): PackageInfo[];
/**
 * Determine applications from packages (heuristic-based)
 */
export declare function identifyApplications(packages: PackageInfo[]): ApplicationInfo[];
/**
 * Create Project GraphEntity
 */
export declare function createProjectEntity(projectInfo: ProjectInfo, projectRoot: string, analysisStats: {
    totalFiles: number;
    totalEntities: number;
    totalPackages: number;
    totalApplications: number;
}): GraphEntity;
/**
 * Create Application GraphEntity
 */
export declare function createApplicationEntity(appInfo: ApplicationInfo, projectRoot: string): GraphEntity;
/**
 * Create Package GraphEntity
 */
export declare function createPackageEntity(pkgInfo: PackageInfo, projectRoot: string): GraphEntity;
//# sourceMappingURL=project-parser.d.ts.map