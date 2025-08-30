import { DirectoryManager } from "./DirectoryManagerRefactored.js";
/**
 * CLI-specific directory utilities using dependency injection
 */
export declare function getSageDirDI(directoryManager: DirectoryManager): string;
export declare function getConfigPathDI(directoryManager: DirectoryManager): string;
export declare function getThreadsDirDI(directoryManager: DirectoryManager): string;
export declare function getProjectSageDirDI(directoryManager: DirectoryManager, cwd?: string): string;
export declare function getTempDirDI(directoryManager: DirectoryManager, prefix?: string): string;
//# sourceMappingURL=cli-utils.d.ts.map