import type { GraphEntity, GraphRelationship } from "../types.js";
import type { PackageInfo } from "./project-parser.js";
export interface DependencyInfo {
    name: string;
    version: string;
    type: "dependency" | "devDependency" | "peerDependency";
    isWorkspaceDependency: boolean;
    packageName?: string;
}
export interface ExternalPackageInfo {
    name: string;
    version?: string;
    description?: string;
    license?: string;
    homepage?: string;
    repository?: string;
    main?: string;
    types?: string;
    isInstalled: boolean;
    packagePath?: string;
}
/**
 * Extract all dependencies from package.json files
 */
export declare function extractDependencies(packages: PackageInfo[]): DependencyInfo[];
/**
 * Try to load package info from node_modules (if --deps flag is used)
 */
export declare function loadExternalPackageInfo(dependencyName: string, projectRoot: string): ExternalPackageInfo | null;
/**
 * Create Dependency GraphEntity (external package)
 */
export declare function createDependencyEntity(depInfo: DependencyInfo, externalInfo: ExternalPackageInfo | null, projectRoot: string): GraphEntity;
/**
 * Create Package -> Dependency relationships
 */
export declare function createPackageDependencyRelationships(packages: PackageInfo[], dependencies: DependencyInfo[], dependencyEntities: GraphEntity[], packageEntities: GraphEntity[]): GraphRelationship[];
/**
 * INSANE MODE: Parse actual import statements to find USED dependencies
 * This connects code entities to external dependencies they actually import from
 */
export declare function findUsedDependencies(entities: GraphEntity[], dependencies: DependencyInfo[]): GraphRelationship[];
//# sourceMappingURL=dependency-parser.d.ts.map