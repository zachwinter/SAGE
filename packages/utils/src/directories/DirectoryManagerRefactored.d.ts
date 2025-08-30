/**
 * Directory Manager Interface
 *
 * Provides a clean abstraction for managing different types of data directories.
 * Enables dependency injection for testing and different deployment environments.
 */
export interface DirectoryManager {
    /**
     * Get the project-specific data directory (usually .sage in CWD)
     * Contains: kuzu database, analysis results, project-specific temp files
     */
    getProjectDir(cwd?: string): string;
    /**
     * Get the user configuration directory
     * Contains: user preferences, auth tokens, global settings
     * Follows OS conventions (XDG on Linux, AppData on Windows, etc.)
     */
    getUserConfigDir(): string;
    /**
     * Get the user data directory
     * Contains: chat threads, model configs, MCP server installations
     * Follows OS conventions for application data
     */
    getUserDataDir(): string;
    /**
     * Get a temporary directory for ephemeral data
     * Should be automatically cleaned up
     */
    getTempDir(prefix?: string): string;
    /**
     * Cleanup temporary directories created by this manager
     */
    cleanup(): Promise<void>;
}
/**
 * Configuration options for directory managers
 */
export interface DirectoryManagerOptions {
    /** Override the default project directory name (default: ".sage") */
    projectDirName?: string;
    /** Override the default app name for OS directories (default: "sage") */
    appName?: string;
    /** Custom base paths for testing or development */
    basePaths?: {
        userConfig?: string;
        userData?: string;
        temp?: string;
    };
}
/**
 * Production Directory Manager
 *
 * Uses OS-appropriate paths following platform conventions:
 * - Linux: XDG Base Directory Specification
 * - macOS: Standard app directories
 * - Windows: AppData directories
 */
export declare class ProductionDirectoryManager implements DirectoryManager {
    private tempDirs;
    private readonly options;
    constructor(options?: DirectoryManagerOptions);
    getProjectDir(cwd?: string): string;
    getUserConfigDir(): string;
    getUserDataDir(): string;
    getTempDir(prefix?: string): string;
    cleanup(): Promise<void>;
    /**
     * Get OS-appropriate configuration directory
     */
    private getOSConfigDir;
    /**
     * Get OS-appropriate data directory
     */
    private getOSDataDir;
    /**
     * Ensure a directory exists, creating it if necessary
     */
    private ensureDirectoryExists;
}
/**
 * Test Directory Manager
 *
 * Creates isolated temporary directories for testing.
 * All directories are automatically cleaned up after tests.
 * Provides completely isolated filesystem operations for reliable testing.
 */
export declare class TestDirectoryManager implements DirectoryManager {
    private readonly baseTempDir;
    private readonly createdDirs;
    private readonly options;
    constructor(options?: DirectoryManagerOptions);
    getProjectDir(cwd?: string): string;
    getUserConfigDir(): string;
    getUserDataDir(): string;
    getTempDir(prefix?: string): string;
    cleanup(): Promise<void>;
    /**
     * Get the base temporary directory for this test session
     */
    getBaseTempDir(): string;
    /**
     * Create a subdirectory within the test environment
     */
    createSubDir(relativePath: string): string;
    /**
     * Create a mock home directory structure for testing
     */
    createMockHome(): {
        homedir: string;
        sage: string;
        config: string;
        threads: string;
    };
    /**
     * Ensure a directory exists, creating it if necessary
     */
    private ensureDirectoryExists;
}
/**
 * Factory function to create a DirectoryManager based on environment
 */
export declare function createDirectoryManager(options?: DirectoryManagerOptions): DirectoryManager;
//# sourceMappingURL=DirectoryManagerRefactored.d.ts.map