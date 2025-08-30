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
 * Directory types for better organization
 */
export interface DirectoryPaths {
  project: string;
  userConfig: string;
  userData: string;
  temp: string;
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
