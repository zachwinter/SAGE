import type { GraphEntity } from "./types.js";
/**
 * Convert generic entity type to first-class entity kind
 */
export declare function getEntityKind(entityType: string): string;
/**
 * Create a unique entity ID
 */
export declare function createEntityId(entity: any, filePath: string): string;
/**
 * Create a unique SourceFile ID
 */
export declare function createSourceFileId(filePath: string): string;
/**
 * Convert generic entity to first-class entity with proper kind and metadata
 */
export declare function createFirstClassEntity(entity: any, filePath: string): GraphEntity;
//# sourceMappingURL=entity-utils.d.ts.map