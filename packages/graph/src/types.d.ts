import ts from "typescript";
export interface IngestOptions {
    projectPath: string;
    commitHash?: string;
}
export interface QueryOptions {
    query: string;
    params?: Record<string, any>;
    commit?: string;
}
export interface QueryResult<T = any> {
    results: T[];
    error?: Error;
    meta?: {
        commit?: string;
        executionTimeMs?: number;
        rowCount?: number;
    };
}
export interface DatabaseConfig {
    path?: string;
    readOnly?: boolean;
    maxNumThreads?: number;
    enableCompression?: boolean;
    maxMemoryUsage?: number;
    logLevel?: "info" | "debug" | "trace";
    timeoutMs?: number;
    debug?: boolean;
}
export interface GraphEntity {
    id: string;
    kind: string;
    name: string;
    text: string;
    filePath: string;
    line: number;
    column_num: number;
    pos: number;
    end: number;
    flags: number;
    parentScopeId?: string;
    extension?: string;
    isModule?: boolean;
    size?: number;
    entityCount?: number;
    totalLines?: number;
    relationshipCount?: number;
    isAsync?: boolean;
    isExported?: boolean;
    isAbstract?: boolean;
    isStatic?: boolean;
    visibility?: string;
    className?: string;
    returnType?: string;
    parameters?: string[];
    superClass?: string;
    interfaces?: string[];
    type?: string;
    isConst?: boolean;
    isReadonly?: boolean;
    isOptional?: boolean;
    scope?: string;
    defaultValue?: string;
    extends?: string[];
    properties?: string[];
    members?: string[];
    definition?: string;
    typeParameters?: string[];
    localName?: string;
    originalName?: string;
    importPath?: string;
    exportType?: string;
    signature?: string;
}
export interface GraphRelationship {
    from: string;
    to: string;
    fromKind: string;
    toKind: string;
    type: string;
    evidence: string;
    confidence: "high" | "medium" | "low";
    metadata: Record<string, any>;
}
export interface AnalysisData {
    entities: GraphEntity[];
    relationships: GraphRelationship[];
}
export interface ContextLine {
    number: number;
    content: string;
}
export type EntityType = "function" | "class" | "interface" | "type" | "import" | "export" | "variable" | "enum";
export interface BaseCodeEntity {
    type: EntityType;
    name: string;
    line: number;
    signature: string;
    contextLines?: ContextLine[];
    id?: string;
    filePath?: string;
    parentScopeId?: string;
}
export interface JavaScriptEntity extends BaseCodeEntity {
    type: "function" | "class" | "interface" | "type" | "import" | "export" | "variable";
    isAsync?: boolean;
    isExported?: boolean;
    isAbstract?: boolean;
    isDefault?: boolean;
    isReExport?: boolean;
    module?: string;
    exportType?: "named" | "default" | "all" | "namespace" | "assignment";
}
export type CodeEntity = JavaScriptEntity;
export interface CallExpression {
    callee: string;
    type: "function" | "method" | "dynamic" | "unknown";
    line: number;
    containingFunction: string | null;
    signature: string;
    argumentCount: number;
}
export interface TypeAlias {
    name: string;
    line: number;
    typeParameters: string[];
    definition: string;
    isExported: boolean;
}
export interface InterfaceInfo {
    name: string;
    line: number;
    typeParameters: string[];
    extends: string[];
    properties: number;
    isExported: boolean;
}
export interface ClassInfo {
    name: string;
    line: number;
    typeParameters: string[];
    extends: string[];
    implements: string[];
    members: number;
    isAbstract: boolean;
    isExported: boolean;
}
export interface EnumInfo {
    name: string;
    line: number;
    members: number;
    isConst: boolean;
    isExported: boolean;
}
export interface TypeInformation {
    typeAliases: TypeAlias[];
    interfaces: InterfaceInfo[];
    classes: ClassInfo[];
    enums: EnumInfo[];
    typeReferences: any[];
}
export interface FileAnalysisResult {
    filePath: string;
    entities: CodeEntity[];
    callExpressions: CallExpression[];
    typeInfo: TypeInformation;
    totalLines: number;
    sourceFile?: ts.SourceFile;
    language?: "rust" | "typescript" | "javascript";
}
export type EntityFilter = string | string[] | null;
export interface AnalysisOptions {
    context?: number;
    calls?: string | boolean;
    types?: boolean;
    showBuiltin?: boolean;
    callDepth?: number;
    flat?: boolean;
    includeDeps?: boolean;
    debug?: boolean;
}
export interface CallGraphAnalysisResult {
    callGraph: Map<string, Set<string>>;
    reverseCallGraph: Map<string, Set<string>>;
    allFunctions: Set<string>;
    analysisResults: FileAnalysisResult[];
}
export interface CallTarget {
    name: string;
    file: string;
    id: string;
}
export interface FunctionCallInfo {
    name: string;
    file: string;
    id: string;
    calls?: CallTarget[];
    callers?: CallTarget[];
}
export interface TopologicalSortResult {
    sorted: CodeEntity[];
    cycles: CodeEntity[];
}
export interface DependencyTreeGroup {
    type: "group";
    name: string;
    entities: CodeEntity[];
    children: any[];
}
export interface TypeWithRelationships {
    name: string;
    line: number;
    kind: "type" | "interface" | "class" | "enum";
    filePath: string;
    id: string;
    relationships: TypeRelationships;
    typeParameters?: string[];
    extends?: string[];
    implements?: string[];
    members?: number;
    isAbstract?: boolean;
    isExported?: boolean;
    isConst?: boolean;
    definition?: string;
}
export interface TypeRelationships {
    extends?: string[];
    implements?: string[];
    implementedBy?: string[];
}
export interface TypeAnalysisResult {
    allTypes: Map<string, TypeWithRelationships>;
    typeRelationships: Map<string, TypeRelationships>;
    analysisResults: FileAnalysisResult[];
}
export interface TypeFileGroup {
    filePath: string;
    typeGroups: {
        interfaces: TypeWithRelationships[];
        classes: TypeWithRelationships[];
        types: TypeWithRelationships[];
        enums: TypeWithRelationships[];
    };
}
export interface RenderData {
    type: "tree" | "flat" | "empty";
    data: any;
    customizer?: (node: any, context?: any) => any;
    title: string;
}
export interface TreeNode {
    name: string;
    link?: string | null;
    metadata?: string;
    children?: any[];
    content?: string[];
}
export type NodeCustomizer = (node: any, context?: any) => TreeNode;
//# sourceMappingURL=types.d.ts.map