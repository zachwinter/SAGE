import { defineConfig } from 'vitest/config';
import type { UserConfig } from 'vitest/config';

export interface SageVitestOptions {
  /** Package-specific test environment (default: 'node') */
  environment?: 'node' | 'jsdom' | 'happy-dom';
  
  /** Test timeout in milliseconds (default: 10000) */
  testTimeout?: number;
  
  /** Enable global test functions like describe, it (default: true) */
  globals?: boolean;
  
  /** Setup files to run before tests */
  setupFiles?: string[];
  
  /** Additional coverage configuration */
  coverage?: {
    enabled?: boolean;
    threshold?: number;
    include?: string[];
    exclude?: string[];
  };
  
  /** Package-specific options for different types */
  packageType?: 'core' | 'analysis' | 'graph' | 'agents' | 'ui' | 'cli';
}

/**
 * Create a standardized Vitest configuration for SAGE packages.
 * 
 * This factory provides consistent test configuration across all packages while
 * allowing customization for specific needs.
 */
export function createSageVitestConfig(options: SageVitestOptions = {}): UserConfig {
  const {
    environment = 'node',
    testTimeout = 10000,
    globals = true,
    setupFiles = [],
    coverage = {},
    packageType = 'core',
  } = options;

  // Package-specific defaults
  const packageDefaults: Record<typeof packageType, Partial<SageVitestOptions>> = {
    core: {
      testTimeout: 5000,
    },
    analysis: {
      testTimeout: 15000, // AST parsing can be slower
      coverage: { threshold: 80 },
    },
    graph: {
      testTimeout: 30000, // Database operations are slower
      coverage: { threshold: 70 },
    },
    agents: {
      testTimeout: 20000, // LLM interactions need time
      setupFiles: ['./src/__tests__/setup.ts'],
    },
    ui: {
      environment: 'jsdom',
      testTimeout: 8000,
      coverage: { threshold: 75 },
    },
    cli: {
      testTimeout: 25000, // Full CLI workflows
      coverage: { threshold: 65 },
    },
  };

  const defaults = packageDefaults[packageType] || {};
  const finalTimeout = options.testTimeout ?? defaults.testTimeout ?? testTimeout;
  const finalSetupFiles = [...(defaults.setupFiles || []), ...setupFiles].filter(
    (file, index, arr) => arr.indexOf(file) === index // Dedupe
  );

  const config: UserConfig = {
    test: {
      environment,
      testTimeout: finalTimeout,
      globals,
      ...(finalSetupFiles.length > 0 && { setupFiles: finalSetupFiles }),
      
      // Coverage configuration
      coverage: coverage.enabled ? {
        reporter: ['text', 'json', 'html'],
        include: coverage.include || ['src/**/*.ts'],
        exclude: [
          'src/**/*.test.ts',
          'src/**/*.spec.ts',
          'src/__tests__/**',
          'src/**/__tests__/**',
          'dist/**',
          ...(coverage.exclude || []),
        ],
        thresholds: coverage.threshold ? {
          global: {
            branches: coverage.threshold,
            functions: coverage.threshold,
            lines: coverage.threshold,
            statements: coverage.threshold,
          },
        } : undefined,
      } : undefined,

      // Retry flaky tests (useful for I/O operations)
      retry: packageType === 'graph' || packageType === 'cli' ? 2 : 0,
      
      // Pool options for better isolation
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: packageType === 'graph', // Graph tests can interfere with each other
        },
      },
    },
  };

  return defineConfig(config);
}

/**
 * Quick factory for common package types.
 */
export const vitestConfigs = {
  core: () => createSageVitestConfig({ packageType: 'core' }),
  analysis: () => createSageVitestConfig({ packageType: 'analysis' }),
  graph: () => createSageVitestConfig({ packageType: 'graph' }),
  agents: () => createSageVitestConfig({ packageType: 'agents' }),
  ui: () => createSageVitestConfig({ packageType: 'ui' }),
  cli: () => createSageVitestConfig({ packageType: 'cli' }),
};

/**
 * Common setup utilities that packages can import for their setup files.
 */
export const setupHelpers = {
  /**
   * Clean up any test artifacts in the workspace.
   */
  async cleanup() {
    // Clean up any .sage directories in test fixtures
    const { rmSync } = await import('fs');
    const { glob } = await import('glob');
    
    try {
      const sageDirs = await glob('**/.sage', { 
        ignore: ['node_modules/**', 'dist/**'],
        dot: true 
      });
      
      for (const dir of sageDirs) {
        rmSync(dir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  },

  /**
   * Setup deterministic environment for tests.
   */
  setupDeterministicEnv() {
    // Set consistent timezone
    process.env.TZ = 'UTC';
    
    // Disable color output for consistent snapshots
    process.env.NO_COLOR = '1';
    process.env.FORCE_COLOR = '0';
    
    // Consistent temp directory
    process.env.TMPDIR = '/tmp';
  },

  /**
   * Mock console methods to capture output during tests.
   */
  mockConsole() {
    const originalConsole = { ...console };
    const logs: string[] = [];
    
    console.log = (...args) => {
      logs.push(args.join(' '));
    };
    
    console.error = (...args) => {
      logs.push('[ERROR] ' + args.join(' '));
    };
    
    console.warn = (...args) => {
      logs.push('[WARN] ' + args.join(' '));
    };
    
    return {
      logs,
      restore: () => {
        Object.assign(console, originalConsole);
      },
    };
  },
};