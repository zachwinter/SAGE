import { existsSync, readFileSync } from "fs";
import { glob } from "glob";
import { join, relative, resolve } from "path";
/**
 * Parse root package.json and determine project structure
 */
export function parseProjectInfo(projectRoot) {
    const packageJsonPath = join(projectRoot, "package.json");
    if (!existsSync(packageJsonPath)) {
        // console.warn(`No package.json found at ${packageJsonPath}`);
        return null;
    }
    try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
        // Check for workspaces in package.json
        let workspaces = packageJson.workspaces || packageJson.workspaces?.packages || [];
        // Also check for pnpm-workspace.yaml
        if (!Array.isArray(workspaces) || workspaces.length === 0) {
            const pnpmWorkspacePath = join(projectRoot, "pnpm-workspace.yaml");
            if (existsSync(pnpmWorkspacePath)) {
                try {
                    const yaml = readFileSync(pnpmWorkspacePath, "utf8");
                    // Simple YAML parsing for pnpm-workspace.yaml
                    const lines = yaml.split("\n");
                    const packageLines = lines.filter(line => line.trim().startsWith("- "));
                    workspaces = packageLines.map(line => line.trim().slice(2).replace(/'/g, ""));
                }
                catch (error) {
                    console.warn(`Failed to parse pnpm-workspace.yaml: ${error}`);
                }
            }
        }
        return {
            name: packageJson.name || "unknown-project",
            version: packageJson.version || "0.0.0",
            description: packageJson.description,
            license: packageJson.license,
            repository: typeof packageJson.repository === "string"
                ? packageJson.repository
                : packageJson.repository?.url,
            homepage: packageJson.homepage,
            workspaces: Array.isArray(workspaces) ? workspaces : [],
            isMonorepo: Array.isArray(workspaces) && workspaces.length > 0
        };
    }
    catch (error) {
        console.warn(`Failed to parse project package.json: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}
/**
 * Find all packages in the project (including workspace packages)
 */
export function findPackages(projectInfo, projectRoot) {
    const packages = [];
    if (projectInfo.isMonorepo && projectInfo.workspaces) {
        // Find workspace packages
        for (const workspacePattern of projectInfo.workspaces) {
            const workspacePaths = glob.sync(workspacePattern, { cwd: projectRoot });
            for (const workspacePath of workspacePaths) {
                const fullWorkspacePath = resolve(projectRoot, workspacePath);
                const packageInfo = parsePackageInfo(fullWorkspacePath);
                if (packageInfo) {
                    packages.push(packageInfo);
                }
            }
        }
    }
    else {
        // Single package project
        const packageInfo = parsePackageInfo(projectRoot);
        if (packageInfo) {
            packages.push(packageInfo);
        }
    }
    return packages;
}
/**
 * Parse a single package.json file
 */
function parsePackageInfo(packagePath) {
    const packageJsonPath = join(packagePath, "package.json");
    if (!existsSync(packageJsonPath)) {
        return null;
    }
    try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
        return {
            name: packageJson.name || "unknown-package",
            version: packageJson.version || "0.0.0",
            description: packageJson.description,
            main: packageJson.main,
            types: packageJson.types || packageJson.typings,
            license: packageJson.license,
            bin: packageJson.bin || {},
            scripts: packageJson.scripts || {},
            dependencies: packageJson.dependencies || {},
            devDependencies: packageJson.devDependencies || {},
            peerDependencies: packageJson.peerDependencies || {},
            engines: packageJson.engines || {},
            packagePath
        };
    }
    catch (error) {
        console.warn(`Failed to parse package.json at ${packagePath}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}
/**
 * Determine applications from packages (heuristic-based)
 */
export function identifyApplications(packages) {
    const applications = [];
    for (const pkg of packages) {
        const entryPoints = [];
        // Determine application type based on package characteristics
        let appType = "package";
        if (Object.keys(pkg.bin).length > 0) {
            appType = "cli";
            // CLI entry points from bin
            for (const binPath of Object.values(pkg.bin)) {
                entryPoints.push(resolve(pkg.packagePath, binPath));
            }
        }
        else if (pkg.main) {
            // Library with main entry
            appType = "library";
            entryPoints.push(resolve(pkg.packagePath, pkg.main));
        }
        // Types entry point
        if (pkg.types && pkg.types !== pkg.main) {
            entryPoints.push(resolve(pkg.packagePath, pkg.types));
        }
        // Common entry point patterns
        const commonEntries = ["index.ts", "index.js", "src/index.ts", "src/main.ts"];
        for (const entry of commonEntries) {
            const entryPath = resolve(pkg.packagePath, entry);
            if (existsSync(entryPath) && !entryPoints.includes(entryPath)) {
                entryPoints.push(entryPath);
                if (!pkg.main) {
                    appType = "library"; // Found an implicit entry point
                }
            }
        }
        applications.push({
            name: pkg.name,
            type: appType,
            packageName: pkg.name,
            main: pkg.main,
            types: pkg.types,
            bin: pkg.bin,
            entryPoints: [...new Set(entryPoints)], // Remove duplicates
            packagePath: pkg.packagePath
        });
    }
    return applications;
}
/**
 * Create Project GraphEntity
 */
export function createProjectEntity(projectInfo, projectRoot, analysisStats) {
    return {
        id: `project_${projectInfo.name.replace(/[^a-zA-Z0-9]/g, "_")}`,
        kind: "Project",
        name: projectInfo.name,
        text: `${projectInfo.name}@${projectInfo.version}${projectInfo.description ? ` - ${projectInfo.description}` : ""}`,
        filePath: projectRoot,
        line: 1,
        column_num: 0,
        pos: 0,
        end: 0,
        flags: 0,
        // Rich metadata
        version: projectInfo.version,
        description: projectInfo.description,
        license: projectInfo.license,
        repository: projectInfo.repository,
        homepage: projectInfo.homepage,
        isMonorepo: projectInfo.isMonorepo,
        totalFiles: analysisStats.totalFiles,
        totalEntities: analysisStats.totalEntities,
        totalPackages: analysisStats.totalPackages,
        totalApplications: analysisStats.totalApplications,
        analysisTimestamp: new Date().toISOString()
    };
}
/**
 * Create Application GraphEntity
 */
export function createApplicationEntity(appInfo, projectRoot) {
    return {
        id: `application_${appInfo.packageName.replace(/[^a-zA-Z0-9]/g, "_")}`,
        kind: "Application",
        name: appInfo.name,
        text: `${appInfo.name} (${appInfo.type})`,
        filePath: relative(projectRoot, appInfo.packagePath),
        line: 1,
        column_num: 0,
        pos: 0,
        end: 0,
        flags: 0,
        // App-specific metadata
        applicationType: appInfo.type,
        packageName: appInfo.packageName,
        entryPointCount: appInfo.entryPoints.length,
        hasMain: !!appInfo.main,
        hasTypes: !!appInfo.types,
        hasBinaries: Object.keys(appInfo.bin || {}).length > 0
    };
}
/**
 * Create Package GraphEntity
 */
export function createPackageEntity(pkgInfo, projectRoot) {
    return {
        id: `package_${pkgInfo.name.replace(/[^a-zA-Z0-9]/g, "_")}`,
        kind: "Package",
        name: pkgInfo.name,
        text: `${pkgInfo.name}@${pkgInfo.version}`,
        filePath: relative(projectRoot, pkgInfo.packagePath),
        line: 1,
        column_num: 0,
        pos: 0,
        end: 0,
        flags: 0,
        // Package metadata
        version: pkgInfo.version,
        description: pkgInfo.description,
        license: pkgInfo.license,
        dependencyCount: Object.keys(pkgInfo.dependencies).length,
        devDependencyCount: Object.keys(pkgInfo.devDependencies).length,
        scriptCount: Object.keys(pkgInfo.scripts).length
    };
}
//# sourceMappingURL=project-parser.js.map