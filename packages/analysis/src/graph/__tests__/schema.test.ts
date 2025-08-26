import { describe, it, expect } from "vitest";
import {
  RELATIONSHIP_TYPES,
  KUZU_SCHEMA_COMMANDS,
  type GraphEntity,
  type GraphRelationship
} from "../schema.js";

describe("Schema Configuration", () => {
  describe("RELATIONSHIP_TYPES", () => {
    it("should contain all expected relationship types", () => {
      expect(RELATIONSHIP_TYPES).toHaveLength(29);
    });

    it("should have the Big 5 relationships in order", () => {
      const big5 = RELATIONSHIP_TYPES.slice(0, 5);
      expect(big5).toEqual([
        "REFERENCES",
        "CALLS",
        "DECLARES",
        "TYPE_OF",
        "DEFINES"
      ]);
    });

    it("should be readonly", () => {
      // TypeScript readonly constraint is compile-time only
      // At runtime, we can still modify but it's a TypeScript error
      const originalValue = RELATIONSHIP_TYPES[0];
      expect(originalValue).toBe("REFERENCES");
      expect(typeof RELATIONSHIP_TYPES).toBe("object");
      expect(Array.isArray(RELATIONSHIP_TYPES)).toBe(true);
      expect(Object.isFrozen(RELATIONSHIP_TYPES)).toBe(true);
    });
  });

  describe("KUZU_SCHEMA_COMMANDS", () => {
    const nodeTableCommands = KUZU_SCHEMA_COMMANDS.filter(cmd =>
      cmd.includes("CREATE NODE TABLE")
    );
    const relTableCommands = KUZU_SCHEMA_COMMANDS.filter(cmd =>
      cmd.includes("CREATE REL TABLE")
    );

    it("should create all required node tables", () => {
      expect(nodeTableCommands).toHaveLength(8);
      expect(nodeTableCommands.some(cmd => cmd.includes("CodeEntity"))).toBe(
        true
      );
      expect(nodeTableCommands.some(cmd => cmd.includes("SourceFile"))).toBe(
        true
      );
      expect(nodeTableCommands.some(cmd => cmd.includes("Module"))).toBe(true);
      expect(nodeTableCommands.some(cmd => cmd.includes("Project"))).toBe(true);
      expect(nodeTableCommands.some(cmd => cmd.includes("Application"))).toBe(
        true
      );
      expect(nodeTableCommands.some(cmd => cmd.includes("Package"))).toBe(true);
      expect(nodeTableCommands.some(cmd => cmd.includes("Dependency"))).toBe(
        true
      );
      expect(nodeTableCommands.some(cmd => cmd.includes("ExternalModule"))).toBe(
        true
      );
    });

    it("should create relationship tables for all relationship types", () => {
      // Check that we have relationship tables for major types
      const expectedRelTables = [
        "REFERENCES",
        "CALLS",
        "DECLARES",
        "TYPE_OF",
        "DEFINES",
        "RETURNS",
        "AWAITS",
        "IMPORTS",
        "EXPORTS",
        "CASTS_TO",
        "UNION_WITH",
        "EXTENDS",
        "IMPLEMENTS",
        "INTERSECTS_WITH",
        "DESTRUCTURES",
        "DECORATES",
        "SPREADS",
        "CATCHES",
        "THROWS",
        "BRANCHES_ON",
        "CONTAINS",
        "BELONGS_TO"
      ];

      expect(relTableCommands.length).toBeGreaterThanOrEqual(
        expectedRelTables.length
      );

      expectedRelTables.forEach(relType => {
        expect(relTableCommands.some(cmd => cmd.includes(relType))).toBe(true);
      });
    });

    it("should have valid SQL syntax for node tables", () => {
      nodeTableCommands.forEach(cmd => {
        // Basic SQL validation
        expect(cmd).toMatch(/CREATE NODE TABLE \w+\(/);
        expect(cmd).toMatch(/PRIMARY KEY\([^)]+\)/);
        expect(cmd).toMatch(/\);$/);
      });
    });

    it("should have valid SQL syntax for relationship tables", () => {
      relTableCommands.forEach(cmd => {
        // Basic SQL validation
        expect(cmd).toMatch(/CREATE REL TABLE \w+\(/);
        expect(cmd).toMatch(/FROM \w+ TO \w+/);
        expect(cmd).toMatch(/\);$/);
      });
    });

    it("should include standard metadata fields in relationship tables", () => {
      const commandsWithMetadata = relTableCommands.filter(
        cmd =>
          cmd.includes("evidence") &&
          cmd.includes("confidence")
      );

      // Most relationship tables should have evidence, confidence, and metadata
      expect(commandsWithMetadata.length).toBeGreaterThan(15);
    });
  });

  describe("Type Definitions", () => {
    it("should have valid GraphEntity interface", () => {
      const entity: GraphEntity = {
        id: "test123",
        kind: "function",
        name: "testFunction",
        text: "function testFunction(): void",
        filePath: "test/file.ts",
        line: 10,
        column: 5,
        pos: 100,
        end: 150,
        flags: 0
      };

      expect(entity.id).toBe("test123");
      expect(entity.kind).toBe("function");
      expect(entity.name).toBe("testFunction");
      expect(entity.line).toBe(10);
    });

    it("should have valid GraphRelationship interface", () => {
      const relationship: GraphRelationship = {
        from: "entity1",
        to: "entity2",
        type: "CALLS",
        evidence: "Direct function call",
        confidence: "high",
        metadata: { argumentCount: "2", line: "15" }
      };

      expect(relationship.from).toBe("entity1");
      expect(relationship.to).toBe("entity2");
      expect(relationship.type).toBe("CALLS");
      expect(relationship.confidence).toBe("high");
      expect(relationship.metadata.argumentCount).toBe("2");
    });

    it("should enforce valid confidence levels", () => {
      const validConfidence: GraphRelationship["confidence"][] = [
        "high",
        "medium",
        "low"
      ];

      validConfidence.forEach(confidence => {
        const relationship: GraphRelationship = {
          from: "entity1",
          to: "entity2",
          type: "CALLS",
          evidence: "test",
          confidence,
          metadata: {}
        };
        expect(relationship.confidence).toBe(confidence);
      });
    });

    it("should enforce valid relationship types", () => {
      RELATIONSHIP_TYPES.forEach(relType => {
        const relationship: GraphRelationship = {
          from: "entity1",
          to: "entity2",
          type: relType,
          evidence: "test",
          confidence: "high",
          metadata: {}
        };
        expect(relationship.type).toBe(relType);
      });
    });
  });

  describe("Schema Consistency", () => {
    it("should have relationship table for each relationship type", () => {
      RELATIONSHIP_TYPES.forEach(relType => {
        const hasTable = KUZU_SCHEMA_COMMANDS.some(
          cmd =>
            cmd.includes(`CREATE REL TABLE ${relType}(`) ||
            cmd.includes(`CREATE REL TABLE ${relType} `)
        );
        expect(hasTable).toBe(true);
      });
    });

    it("should have consistent field naming in CodeEntity table", () => {
      const codeEntityCmd = KUZU_SCHEMA_COMMANDS.find(cmd =>
        cmd.includes("CREATE NODE TABLE CodeEntity")
      );

      expect(codeEntityCmd).toBeDefined();
      expect(codeEntityCmd).toContain("id STRING");
      expect(codeEntityCmd).toContain("kind STRING");
      expect(codeEntityCmd).toContain("name STRING");
      expect(codeEntityCmd).toContain("text STRING");
      expect(codeEntityCmd).toContain("filePath STRING");
      expect(codeEntityCmd).toContain("lineNum INT64");
      expect(codeEntityCmd).toContain("colNum INT64");
      expect(codeEntityCmd).toContain("startPos INT64");
      expect(codeEntityCmd).toContain("endPos INT64");
      expect(codeEntityCmd).toContain("nodeFlags INT64");
      expect(codeEntityCmd).toContain("PRIMARY KEY(id)");
    });

    it("should have consistent field naming in SourceFile table", () => {
      const sourceFileCmd = KUZU_SCHEMA_COMMANDS.find(cmd =>
        cmd.includes("CREATE NODE TABLE SourceFile")
      );

      expect(sourceFileCmd).toBeDefined();
      expect(sourceFileCmd).toContain("path STRING");
      expect(sourceFileCmd).toContain("extension STRING");
      expect(sourceFileCmd).toContain("size INT64");
      expect(sourceFileCmd).toContain("totalLines INT64");
      expect(sourceFileCmd).toContain("PRIMARY KEY(path)");
    });
  });

  describe("Performance Considerations", () => {
    it("should prioritize Big 5 relationships first", () => {
      const big5 = ["REFERENCES", "CALLS", "DECLARES", "TYPE_OF", "DEFINES"];
      const firstFive = [...RELATIONSHIP_TYPES].slice(0, 5);

      expect(firstFive).toEqual(big5);
    });

    it("should have reasonable number of relationship types", () => {
      // Should be comprehensive but not overwhelming
      expect(RELATIONSHIP_TYPES.length).toBeGreaterThan(15);
      expect(RELATIONSHIP_TYPES.length).toBeLessThan(30);
    });

    it("should have all schema commands", () => {
      expect(KUZU_SCHEMA_COMMANDS.length).toBeGreaterThan(20);
      expect(KUZU_SCHEMA_COMMANDS.every(cmd => typeof cmd === "string")).toBe(true);
      expect(KUZU_SCHEMA_COMMANDS.every(cmd => cmd.length > 0)).toBe(true);
    });
  });
});
