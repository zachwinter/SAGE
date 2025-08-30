import path from "path";
/**
 * CLI-specific directory utilities using dependency injection
 */
export function getSageDirDI(directoryManager) {
    return directoryManager.getUserDataDir();
}
export function getConfigPathDI(directoryManager) {
    return path.join(directoryManager.getUserConfigDir(), "config.json");
}
export function getThreadsDirDI(directoryManager) {
    return path.join(directoryManager.getUserDataDir(), "threads");
}
export function getProjectSageDirDI(directoryManager, cwd) {
    return directoryManager.getProjectDir(cwd);
}
export function getTempDirDI(directoryManager, prefix) {
    return directoryManager.getTempDir(prefix);
}
//# sourceMappingURL=cli-utils.js.map