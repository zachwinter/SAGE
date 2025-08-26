import ts from "typescript";

// Graph-native types (matching Rust format for zero-conversion)
export interface GraphEntity {
  id: string;
  kind: string;
  name: string;
  text: string;
  filePath: string;
  line: number;
  column: number;
  pos: number;
  end: number;
  flags: number;
  parentScopeId?: string; // For scope-based CONTAINS relationships
}

export interface GraphRelationship {
  from: string;
  to: string;
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

export type EntityType =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "import"
  | "export"
  | "variable"
  | "struct"
  | "enum"
  | "trait"
  | "implementation"
  | "module"
  | "constant"
  | "static"
  | "type-alias";

export interface BaseCodeEntity {
  type: EntityType;
  name: string;
  line: number;
  signature: string;
  contextLines?: ContextLine[];
  id?: string;
  filePath?: string;
  parentScopeId?: string; // NEW: For scope-based CONTAINS relationships
}

export interface JavaScriptEntity extends BaseCodeEntity {
  type:
    | "function"
    | "class"
    | "interface"
    | "type"
    | "import"
    | "export"
    | "variable";
  isAsync?: boolean;
  isExported?: boolean;
  isAbstract?: boolean;
  isDefault?: boolean;
  isReExport?: boolean;
  module?: string;
  exportType?: "named" | "default" | "all" | "namespace" | "assignment";
}

export interface RustEntity extends BaseCodeEntity {
  type:
    | "function"
    | "struct"
    | "enum"
    | "trait"
    | "implementation"
    | "module"
    | "import"
    | "constant"
    | "static"
    | "type-alias";
  language: "rust";
}

export type CodeEntity = JavaScriptEntity | RustEntity;

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
}

// Call Graph Types
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

// Topological Sort Types
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

// Type Analysis Types
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

// Render Types
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

// Customizer function type
export type NodeCustomizer = (node: any, context?: any) => TreeNode;
