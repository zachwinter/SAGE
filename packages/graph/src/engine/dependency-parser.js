import { readFileSync, existsSync } from "fs";
import { join } from "path";
/**
 * Extract all dependencies from package.json files
 */
export function extractDependencies(packages) {
    const allDeps = [];
    const workspacePackageNames = new Set(packages.map(p => p.name));
    for (const pkg of packages) {
        // Regular dependencies
        for (const [name, version] of Object.entries(pkg.dependencies)) {
            allDeps.push({
                name,
                version,
                type: "dependency",
                isWorkspaceDependency: workspacePackageNames.has(name),
                packageName: workspacePackageNames.has(name) ? name : undefined
            });
        }
        // Dev dependencies
        for (const [name, version] of Object.entries(pkg.devDependencies)) {
            allDeps.push({
                name,
                version,
                type: "devDependency",
                isWorkspaceDependency: workspacePackageNames.has(name),
                packageName: workspacePackageNames.has(name) ? name : undefined
            });
        }
        // Peer dependencies
        for (const [name, version] of Object.entries(pkg.peerDependencies)) {
            allDeps.push({
                name,
                version,
                type: "peerDependency",
                isWorkspaceDependency: workspacePackageNames.has(name),
                packageName: workspacePackageNames.has(name) ? name : undefined
            });
        }
    }
    // Remove duplicates (same name+version)
    const uniqueDeps = new Map();
    for (const dep of allDeps) {
        const key = `${dep.name}@${dep.version}`;
        if (!uniqueDeps.has(key)) {
            uniqueDeps.set(key, dep);
        }
    }
    return Array.from(uniqueDeps.values());
}
/**
 * Try to load package info from node_modules (if --deps flag is used)
 */
export function loadExternalPackageInfo(dependencyName, projectRoot) {
    const possiblePaths = [
        join(projectRoot, "node_modules", dependencyName, "package.json"),
        join(projectRoot, "..", "node_modules", dependencyName, "package.json"), // Hoisted
        join(projectRoot, "..", "..", "node_modules", dependencyName, "package.json") // More hoisted
    ];
    for (const packageJsonPath of possiblePaths) {
        if (existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
                return {
                    name: packageJson.name || dependencyName,
                    version: packageJson.version,
                    description: packageJson.description,
                    license: packageJson.license,
                    homepage: packageJson.homepage,
                    repository: typeof packageJson.repository === "string"
                        ? packageJson.repository
                        : packageJson.repository?.url,
                    main: packageJson.main,
                    types: packageJson.types || packageJson.typings,
                    isInstalled: true,
                    packagePath: packageJsonPath.replace("/package.json", "")
                };
            }
            catch (error) {
                console.warn(`Failed to parse ${packageJsonPath}: ${error}`);
            }
        }
    }
    // If not found, create a placeholder
    return {
        name: dependencyName,
        isInstalled: false
    };
}
/**
 * Create Dependency GraphEntity (external package)
 */
export function createDependencyEntity(depInfo, externalInfo, projectRoot) {
    const info = externalInfo || { name: depInfo.name, isInstalled: false };
    return {
        id: `dependency_${depInfo.name.replace(/[^a-zA-Z0-9]/g, "_")}`,
        kind: "Dependency",
        name: depInfo.name,
        text: `${depInfo.name}@${depInfo.version}${info.description ? ` - ${info.description}` : ""}`,
        filePath: info.packagePath
            ? info.packagePath.replace(projectRoot, ".")
            : "node_modules",
        line: 1,
        column_num: 0,
        pos: 0,
        end: 0,
        flags: 0,
        // Dependency metadata
        version: depInfo.version,
        actualVersion: info.version,
        dependencyType: depInfo.type,
        isWorkspaceDependency: depInfo.isWorkspaceDependency,
        isInstalled: info.isInstalled,
        description: info.description,
        license: info.license,
        homepage: info.homepage,
        repository: info.repository,
        hasMain: !!info.main,
        hasTypes: !!info.types
    };
}
/**
 * Create Package -> Dependency relationships
 */
export function createPackageDependencyRelationships(packages, dependencies, dependencyEntities, packageEntities) {
    const relationships = [];
    for (const pkg of packages) {
        const packageEntity = packageEntities.find(p => p.name === pkg.name);
        if (!packageEntity)
            continue;
        // Get all dependencies for this package
        const packageDeps = [
            ...Object.entries(pkg.dependencies).map(([name, version]) => ({
                name,
                version,
                type: "dependency"
            })),
            ...Object.entries(pkg.devDependencies).map(([name, version]) => ({
                name,
                version,
                type: "devDependency"
            })),
            ...Object.entries(pkg.peerDependencies).map(([name, version]) => ({
                name,
                version,
                type: "peerDependency"
            }))
        ];
        for (const dep of packageDeps) {
            const depEntity = dependencyEntities.find(d => d.name === dep.name);
            if (!depEntity)
                continue;
            relationships.push({
                from: packageEntity.id,
                to: depEntity.id,
                fromKind: packageEntity.kind,
                toKind: depEntity.kind,
                type: "DEPENDS_ON",
                evidence: `${pkg.name} depends on ${dep.name}@${dep.version}`,
                confidence: "high",
                metadata: {
                    dependencyType: dep.type,
                    version: dep.version,
                    packageName: pkg.name,
                    isWorkspaceDependency: depEntity.isWorkspaceDependency
                }
            });
        }
    }
    return relationships;
}
/**
 * INSANE MODE: Parse actual import statements to find USED dependencies
 * This connects code entities to external dependencies they actually import from
 */
export function findUsedDependencies(entities, dependencies) {
    const relationships = [];
    const dependencyNames = new Set(dependencies.map(d => d.name));
    // Find import entities that reference external packages
    const importEntities = entities.filter(e => e.kind === "import");
    for (const importEntity of importEntities) {
        // Get the module specifier that was stored during import processing
        const moduleSpecifier = importEntity.moduleSpecifier;
        if (!moduleSpecifier || moduleSpecifier.startsWith(".")) {
            // Skip local imports or imports without module specifiers
            continue;
        }
        // Extract package name from module specifier (handle scoped packages)
        let packageName = "";
        if (moduleSpecifier.startsWith("@")) {
            // Scoped package: @scope/package or @scope/package/subpath
            const parts = moduleSpecifier.split("/");
            if (parts.length >= 2) {
                packageName = `${parts[0]}/${parts[1]}`;
            }
        }
        else {
            // Regular package: package or package/subpath
            packageName = moduleSpecifier.split("/")[0];
        }
        if (dependencyNames.has(packageName)) {
            // Find the corresponding dependency entity
            const dependencyEntity = entities.find(e => e.kind === "Dependency" && e.name === packageName);
            if (dependencyEntity) {
                relationships.push({
                    from: importEntity.id,
                    to: dependencyEntity.id,
                    fromKind: importEntity.kind,
                    toKind: dependencyEntity.kind,
                    type: "IMPORTS_FROM",
                    evidence: `Import statement references external package ${packageName}`,
                    confidence: "high",
                    metadata: {
                        moduleSpecifier: moduleSpecifier,
                        packageName: packageName,
                        isExternalDependency: true,
                        importedNames: importEntity.name
                    }
                });
            }
        }
    }
    return relationships;
}
//# sourceMappingURL=dependency-parser.js.map