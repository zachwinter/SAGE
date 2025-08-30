import type { GraphEntity, GraphRelationship } from "./types.js";
/**
 * Validate if a relationship is allowed based on the Kuzu schema
 */
export declare function isRelationshipAllowed(relationshipType: string, fromKind: string, toKind: string): boolean;
/**
 * Filter relationships to only include those allowed by the Kuzu schema
 */
export declare function filterValidRelationships(relationships: GraphRelationship[], entities: GraphEntity[], debug?: boolean): GraphRelationship[];
//# sourceMappingURL=relationship-validator.d.ts.map