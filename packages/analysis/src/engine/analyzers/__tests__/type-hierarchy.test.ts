import { describe, it, expect } from "vitest";
import { performTypeAnalysis } from "../type-hierarchy.js";

describe("type-hierarchy", () => {
  describe("performTypeAnalysis", () => {
    it("should return empty maps when no analysis results provided", () => {
      const results = [];
      const analysis = performTypeAnalysis(results);
      
      expect(analysis.allTypes.size).toBe(0);
      expect(analysis.typeRelationships.size).toBe(0);
      expect(analysis.analysisResults).toEqual(results);
    });

    it("should process type aliases", () => {
      const results = [
        {
          filePath: "/test/file1.ts",
          entities: [],
          callExpressions: [],
          typeInfo: {
            typeAliases: [
              {
                name: "UserId",
                line: 1,
                typeParameters: [],
                definition: "string",
                isExported: true
              }
            ],
            interfaces: [],
            classes: [],
            enums: [],
            typeReferences: []
          },
          totalLines: 5
        }
      ];
      
      const analysis = performTypeAnalysis(results);
      
      expect(analysis.allTypes.size).toBe(1);
      const typeId = "/test/file1.ts:UserId";
      expect(analysis.allTypes.has(typeId)).toBe(true);
      
      const typeAlias = analysis.allTypes.get(typeId);
      expect(typeAlias).toMatchObject({
        name: "UserId",
        line: 1,
        kind: "type",
        filePath: "/test/file1.ts",
        definition: "string",
        isExported: true
      });
    });

    it("should process interfaces", () => {
      const results = [
        {
          filePath: "/test/file1.ts",
          entities: [],
          callExpressions: [],
          typeInfo: {
            typeAliases: [],
            interfaces: [
              {
                name: "User",
                line: 1,
                typeParameters: [],
                extends: [],
                properties: 2,
                isExported: true
              }
            ],
            classes: [],
            enums: [],
            typeReferences: []
          },
          totalLines: 5
        }
      ];
      
      const analysis = performTypeAnalysis(results);
      
      expect(analysis.allTypes.size).toBe(1);
      const typeId = "/test/file1.ts:User";
      expect(analysis.allTypes.has(typeId)).toBe(true);
      
      const iface = analysis.allTypes.get(typeId);
      expect(iface).toMatchObject({
        name: "User",
        line: 1,
        kind: "interface",
        filePath: "/test/file1.ts",
        properties: 2,
        isExported: true
      });
    });

    it("should process interfaces with inheritance", () => {
      const results = [
        {
          filePath: "/test/file1.ts",
          entities: [],
          callExpressions: [],
          typeInfo: {
            typeAliases: [],
            interfaces: [
              {
                name: "Person",
                line: 1,
                typeParameters: [],
                extends: [],
                properties: 1,
                isExported: true
              },
              {
                name: "Employee",
                line: 5,
                typeParameters: [],
                extends: ["Person"],
                properties: 2,
                isExported: true
              }
            ],
            classes: [],
            enums: [],
            typeReferences: []
          },
          totalLines: 10
        }
      ];
      
      const analysis = performTypeAnalysis(results);
      
      // Check that both interfaces are processed
      expect(analysis.allTypes.size).toBe(2);
      
      // Check Person interface
      const personId = "/test/file1.ts:Person";
      expect(analysis.allTypes.has(personId)).toBe(true);
      const person = analysis.allTypes.get(personId);
      expect(person).toMatchObject({
        name: "Person",
        kind: "interface",
        filePath: "/test/file1.ts"
      });
      
      // Check Employee interface
      const employeeId = "/test/file1.ts:Employee";
      expect(analysis.allTypes.has(employeeId)).toBe(true);
      const employee = analysis.allTypes.get(employeeId);
      expect(employee).toMatchObject({
        name: "Employee",
        kind: "interface",
        filePath: "/test/file1.ts"
      });
      
      // Check inheritance relationships
      expect(analysis.typeRelationships.size).toBe(1);
      expect(analysis.typeRelationships.has(employeeId)).toBe(true);
      
      const relationships = analysis.typeRelationships.get(employeeId);
      expect(relationships).toMatchObject({
        extends: ["Person"]
      });
    });

    it("should process classes", () => {
      const results = [
        {
          filePath: "/test/file1.ts",
          entities: [],
          callExpressions: [],
          typeInfo: {
            typeAliases: [],
            interfaces: [],
            classes: [
              {
                name: "UserService",
                line: 1,
                typeParameters: [],
                extends: [],
                implements: [],
                members: 3,
                isAbstract: false,
                isExported: true
              }
            ],
            enums: [],
            typeReferences: []
          },
          totalLines: 10
        }
      ];
      
      const analysis = performTypeAnalysis(results);
      
      expect(analysis.allTypes.size).toBe(1);
      const typeId = "/test/file1.ts:UserService";
      expect(analysis.allTypes.has(typeId)).toBe(true);
      
      const cls = analysis.allTypes.get(typeId);
      expect(cls).toMatchObject({
        name: "UserService",
        line: 1,
        kind: "class",
        filePath: "/test/file1.ts",
        members: 3,
        isAbstract: false,
        isExported: true
      });
    });

    it("should process classes with inheritance and implementation", () => {
      const results = [
        {
          filePath: "/test/file1.ts",
          entities: [],
          callExpressions: [],
          typeInfo: {
            typeAliases: [],
            interfaces: [
              {
                name: "Logger",
                line: 1,
                typeParameters: [],
                extends: [],
                properties: 1,
                isExported: true
              }
            ],
            classes: [
              {
                name: "BaseService",
                line: 5,
                typeParameters: [],
                extends: ["Object"],
                implements: [],
                members: 1,
                isAbstract: true,
                isExported: true
              },
              {
                name: "UserService",
                line: 10,
                typeParameters: [],
                extends: ["BaseService"],
                implements: ["Logger"],
                members: 3,
                isAbstract: false,
                isExported: true
              }
            ],
            enums: [],
            typeReferences: []
          },
          totalLines: 20
        }
      ];
      
      const analysis = performTypeAnalysis(results);
      
      // Check that all types are processed
      expect(analysis.allTypes.size).toBe(3);
      
      // Check UserService class
      const userServiceId = "/test/file1.ts:UserService";
      expect(analysis.allTypes.has(userServiceId)).toBe(true);
      const userService = analysis.allTypes.get(userServiceId);
      expect(userService).toMatchObject({
        name: "UserService",
        kind: "class",
        filePath: "/test/file1.ts"
      });
      
      // Check inheritance and implementation relationships
      expect(analysis.typeRelationships.size).toBe(2); // BaseService and UserService
      expect(analysis.typeRelationships.has(userServiceId)).toBe(true);
      
      const relationships = analysis.typeRelationships.get(userServiceId);
      expect(relationships).toMatchObject({
        extends: ["BaseService"],
        implements: ["Logger"]
      });
    });

    it("should process enums", () => {
      const results = [
        {
          filePath: "/test/file1.ts",
          entities: [],
          callExpressions: [],
          typeInfo: {
            typeAliases: [],
            interfaces: [],
            classes: [],
            enums: [
              {
                name: "Status",
                line: 1,
                members: 3,
                isConst: false,
                isExported: true
              }
            ],
            typeReferences: []
          },
          totalLines: 5
        }
      ];
      
      const analysis = performTypeAnalysis(results);
      
      expect(analysis.allTypes.size).toBe(1);
      const typeId = "/test/file1.ts:Status";
      expect(analysis.allTypes.has(typeId)).toBe(true);
      
      const enumDef = analysis.allTypes.get(typeId);
      expect(enumDef).toMatchObject({
        name: "Status",
        line: 1,
        kind: "enum",
        filePath: "/test/file1.ts",
        members: 3,
        isConst: false,
        isExported: true
      });
    });

    it("should handle multiple files", () => {
      const results = [
        {
          filePath: "/test/file1.ts",
          entities: [],
          callExpressions: [],
          typeInfo: {
            typeAliases: [
              {
                name: "UserId",
                line: 1,
                typeParameters: [],
                definition: "string",
                isExported: true
              }
            ],
            interfaces: [],
            classes: [],
            enums: [],
            typeReferences: []
          },
          totalLines: 5
        },
        {
          filePath: "/test/file2.ts",
          entities: [],
          callExpressions: [],
          typeInfo: {
            typeAliases: [],
            interfaces: [
              {
                name: "User",
                line: 1,
                typeParameters: [],
                extends: [],
                properties: 2,
                isExported: true
              }
            ],
            classes: [],
            enums: [],
            typeReferences: []
          },
          totalLines: 5
        }
      ];
      
      const analysis = performTypeAnalysis(results);
      
      // Check that types from both files are processed
      expect(analysis.allTypes.size).toBe(2);
      
      const userId = "/test/file1.ts:UserId";
      const userInterfaceId = "/test/file2.ts:User";
      
      expect(analysis.allTypes.has(userId)).toBe(true);
      expect(analysis.allTypes.has(userInterfaceId)).toBe(true);
      
      const userIdType = analysis.allTypes.get(userId);
      expect(userIdType).toMatchObject({
        name: "UserId",
        kind: "type",
        filePath: "/test/file1.ts"
      });
      
      const userInterface = analysis.allTypes.get(userInterfaceId);
      expect(userInterface).toMatchObject({
        name: "User",
        kind: "interface",
        filePath: "/test/file2.ts"
      });
    });
  });
});