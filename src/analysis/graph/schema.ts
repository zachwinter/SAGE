// 🚀 KUZU GRAPH SCHEMA - Based on TypeScript's Self-Analysis
// Derived from statistical analysis of 80k+ real-world relationships

export const RELATIONSHIP_TYPES = Object.freeze([
  // The Big 5 - 84% of all relationships in real codebases
  "REFERENCES", // 30.27% - Property access, variable usage, this, templates
  "CALLS", // 23.01% - Method calls, function calls
  "DECLARES", // 15.27% - Variables, functions, types, parameters
  "TYPE_OF", // 8.97%  - Type references, generics
  "DEFINES", // 7.73%  - Variable assignments, initializers

  // Control Flow & Structure
  "RETURNS", // 3.77%  - Return statements
  "AWAITS", // 1.83%  - Async operations
  "IMPORTS", // 1.58%  - Module dependencies
  "EXPORTS", // 0.57%  - Module exports

  // Type System
  "CASTS_TO", // 1.24%  - Type assertions
  "UNION_WITH", // 0.82%  - Union types
  "EXTENDS", // 0.55%  - Inheritance
  "IMPLEMENTS", // 0.05%  - Interface implementation
  "INTERSECTS_WITH", // 0.02%  - Intersection types

  // Language Features
  "DESTRUCTURES", // 1.21%  - Destructuring patterns
  "DECORATES", // 1.03%  - Decorators
  "SPREADS", // 0.44%  - Spread syntax
  "CATCHES", // 0.70%  - Error handling
  "THROWS", // 0.35%  - Exception throwing
  "BRANCHES_ON" // 0.60%  - Conditional expressions
] as const);

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

// Kuzu Schema Creation Commands
export const KUZU_SCHEMA_COMMANDS = [
  // Core node table for all code entities
  `CREATE NODE TABLE CodeEntity(
    id STRING,
    kind STRING,
    name STRING,
    text STRING,
    filePath STRING,
    lineNum INT64,
    colNum INT64,
    startPos INT64,
    endPos INT64,
    nodeFlags INT64,
    PRIMARY KEY(id)
  );`,

  // File nodes for organizing entities
  `CREATE NODE TABLE SourceFile(
    path STRING,
    extension STRING,
    size INT64,
    totalLines INT64,
    entityCount INT64,
    relationshipCount INT64,
    PRIMARY KEY(path)
  );`,

  // Module/Package organization
  `CREATE NODE TABLE Module(
    name STRING,
    path STRING,
    isExternal BOOLEAN,
    PRIMARY KEY(name)
  );`,

  // The Big 5 Relationship Tables
  `CREATE REL TABLE REFERENCES(FROM CodeEntity TO CodeEntity, 
    evidence STRING, confidence STRING, metadata MAP(STRING, STRING));`,

  `CREATE REL TABLE CALLS(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, isAsync BOOLEAN, metadata MAP(STRING, STRING));`,

  `CREATE REL TABLE DECLARES(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, scope STRING, metadata MAP(STRING, STRING));`,

  `CREATE REL TABLE TYPE_OF(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, isGeneric BOOLEAN, metadata MAP(STRING, STRING));`,

  `CREATE REL TABLE DEFINES(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, isInitializer BOOLEAN, metadata MAP(STRING, STRING));`,

  // Control Flow & Structure
  `CREATE REL TABLE RETURNS(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata MAP(STRING, STRING));`,

  `CREATE REL TABLE AWAITS(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata MAP(STRING, STRING));`,

  `CREATE REL TABLE IMPORTS(FROM CodeEntity TO Module,
    evidence STRING, confidence STRING, specifier STRING, metadata MAP(STRING, STRING));`,

  `CREATE REL TABLE EXPORTS(FROM CodeEntity TO Module,
    evidence STRING, confidence STRING, exportType STRING, metadata MAP(STRING, STRING));`,

  // Type System
  `CREATE REL TABLE CASTS_TO(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata MAP(STRING, STRING));`,

  `CREATE REL TABLE UNION_WITH(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata MAP(STRING, STRING));`,

  `CREATE REL TABLE EXTENDS(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata MAP(STRING, STRING));`,

  `CREATE REL TABLE IMPLEMENTS(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata MAP(STRING, STRING));`,

  `CREATE REL TABLE INTERSECTS_WITH(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata MAP(STRING, STRING));`,

  // Language Features
  `CREATE REL TABLE DESTRUCTURES(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata MAP(STRING, STRING));`,

  `CREATE REL TABLE DECORATES(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata MAP(STRING, STRING));`,

  `CREATE REL TABLE SPREADS(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata MAP(STRING, STRING));`,

  `CREATE REL TABLE CATCHES(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata MAP(STRING, STRING));`,

  `CREATE REL TABLE THROWS(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata MAP(STRING, STRING));`,

  `CREATE REL TABLE BRANCHES_ON(FROM CodeEntity TO CodeEntity,
    evidence STRING, confidence STRING, metadata MAP(STRING, STRING));`,

  // File organization relationships
  `CREATE REL TABLE CONTAINS(FROM SourceFile TO CodeEntity);`,
  `CREATE REL TABLE BELONGS_TO(FROM CodeEntity TO Module);`
];

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
}

export interface GraphRelationship {
  from: string;
  to: string;
  type: RelationshipType;
  evidence: string;
  confidence: "high" | "medium" | "low";
  metadata: Record<string, any>;
}
