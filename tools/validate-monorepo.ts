#!/usr/bin/env tsx

/**
 * Monorepo validation script - ensures everything is properly wired
 * Run this after any monorepo changes to catch resolution issues early
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'

interface ValidationCheck {
  name: string
  check: () => Promise<void> | void
}

const checks: ValidationCheck[] = [
  {
    name: '📦 pnpm workspace structure',
    check() {
      if (!existsSync('pnpm-workspace.yaml')) {
        throw new Error('pnpm-workspace.yaml missing')
      }
      
      if (!existsSync('packages/analysis/package.json')) {
        throw new Error('@sage/analysis package.json missing')
      }
      
      if (!existsSync('apps/cli/package.json')) {
        throw new Error('@sage/cli package.json missing')
      }
      
      console.log('  ✅ Workspace structure looks good')
    }
  },
  
  {
    name: '🔧 TypeScript compilation',
    check() {
      try {
        // Check if TypeScript can resolve all imports without building
        execSync('pnpm tsc --noEmit', { stdio: 'pipe' })
        console.log('  ✅ TypeScript compilation succeeds')
      } catch (error: any) {
        console.error('  ❌ TypeScript errors:')
        console.error(error.stdout?.toString() || error.stderr?.toString())
        throw new Error('TypeScript compilation failed')
      }
    }
  },
  
  {
    name: '🏗️  Package builds',
    check() {
      try {
        execSync('pnpm -F @sage/analysis build', { stdio: 'pipe' })
        console.log('  ✅ @sage/analysis builds successfully')
        
        execSync('pnpm -F @sage/cli build', { stdio: 'pipe' })
        console.log('  ✅ @sage/cli builds successfully')
      } catch (error: any) {
        console.error('  ❌ Build error:')
        console.error(error.stdout?.toString() || error.stderr?.toString())
        throw new Error('Package builds failed')
      }
    }
  },
  
  {
    name: '📥 Runtime import resolution',
    check: async () => {
      try {
        // Test that we can actually import from @sage/analysis at runtime
        const { analyzeFiles, getCodeFiles } = await import('@sage/analysis')
        
        if (typeof analyzeFiles !== 'function') {
          throw new Error('analyzeFiles is not a function')
        }
        
        if (typeof getCodeFiles !== 'function') {
          throw new Error('getCodeFiles is not a function')
        }
        
        console.log('  ✅ Runtime imports work correctly')
      } catch (error: any) {
        console.error('  ❌ Runtime import error:', error.message)
        throw error
      }
    }
  },
  
  {
    name: '🧪 Test suites',
    check() {
      try {
        execSync('pnpm -F @sage/analysis test --run', { stdio: 'pipe' })
        console.log('  ✅ @sage/analysis tests pass')
        
        execSync('pnpm -F @sage/cli test --run', { stdio: 'pipe' })
        console.log('  ✅ @sage/cli tests pass')
      } catch (error: any) {
        console.error('  ❌ Test failures:')
        console.error(error.stdout?.toString() || error.stderr?.toString())
        throw new Error('Tests failed')
      }
    }
  },
  
  {
    name: '🎯 Dependency resolution',
    check() {
      try {
        const cliPackageJson = JSON.parse(
          execSync('cat apps/cli/package.json', { encoding: 'utf8' })
        )
        
        if (cliPackageJson.dependencies['@sage/analysis'] !== 'workspace:*') {
          throw new Error('@sage/cli should depend on "@sage/analysis": "workspace:*"')
        }
        
        console.log('  ✅ Workspace dependencies properly configured')
      } catch (error: any) {
        console.error('  ❌ Dependency resolution error:', error.message)
        throw error
      }
    }
  }
]

async function runValidation() {
  console.log('🔍 Validating monorepo setup...\n')
  
  let passed = 0
  let failed = 0
  
  for (const { name, check } of checks) {
    try {
      console.log(name)
      await check()
      passed++
    } catch (error: any) {
      console.error(`❌ ${name} failed:`, error.message)
      failed++
    }
    console.log('')
  }
  
  console.log('📊 Results:')
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  
  if (failed > 0) {
    console.log('\n🚨 Some validations failed. Please fix the issues above.')
    process.exit(1)
  } else {
    console.log('\n🎉 All validations passed! Monorepo is properly configured.')
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidation().catch(console.error)
}