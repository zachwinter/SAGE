import ts from "typescript";
import type {
  AnalysisOptions,
  CodeEntity,
  CallExpression,
  TypeInformation
} from "../../types.js";

export function extractEntitiesFromAST(
  sourceFile: ts.SourceFile,
  options: AnalysisOptions = {}
): CodeEntity[] {
  const entities: CodeEntity[] = [];

  function visit(node: ts.Node) {
    // Get line number for the node
    const sourceFile = node.getSourceFile();
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const lineNumber = line + 1;

    // Function declarations
    if (isFunctionDeclaration(node)) {
      const name = node.name?.text || "anonymous";
      entities.push({
        type: "function",
        name,
        line: lineNumber,
        signature: node.getText().split("\n")[0].trim(),
        isAsync: !!node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword),
        isExported: !!node.modifiers?.some(
          m => m.kind === ts.SyntaxKind.ExportKeyword
        )
      });
    }

    // Class declarations
    if (isClassDeclaration(node)) {
      const name = node.name?.text || "anonymous";
      entities.push({
        type: "class",
        name,
        line: lineNumber,
        signature: node.getText().split("\n")[0].trim(),
        isAbstract: !!node.modifiers?.some(
          m => m.kind === ts.SyntaxKind.AbstractKeyword
        ),
        isExported: !!node.modifiers?.some(
          m => m.kind === ts.SyntaxKind.ExportKeyword
        )
      });
    }

    // Method declarations
    if (node.kind === ts.SyntaxKind.MethodDeclaration) {
      const methodNode = node as ts.MethodDeclaration;
      const name = methodNode.name?.getText() || "anonymous";
      entities.push({
        type: "function",
        name,
        line: lineNumber,
        signature: methodNode.getText().split("\n")[0].trim(),
        isAsync: !!methodNode.modifiers?.some(
          m => m.kind === ts.SyntaxKind.AsyncKeyword
        ),
        isExported: false // Methods are not directly exported
      });
    }

    // Interface declarations
    if (isInterfaceDeclaration(node)) {
      const name = node.name?.text || "anonymous";
      entities.push({
        type: "interface",
        name,
        line: lineNumber,
        signature: node.getText().split("\n")[0].trim(),
        isExported: !!node.modifiers?.some(
          m => m.kind === ts.SyntaxKind.ExportKeyword
        )
      });
    }

    // Type alias declarations
    if (isTypeAliasDeclaration(node)) {
      const name = node.name?.text || "anonymous";
      entities.push({
        type: "type",
        name,
        line: lineNumber,
        signature: node.getText().split("\n")[0].trim(),
        isExported: !!node.modifiers?.some(
          m => m.kind === ts.SyntaxKind.ExportKeyword
        )
      });
    }

    // Import declarations
    if (isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier?.text || "unknown";
      const importClause = node.importClause;
      let importedNames = [];

      if (importClause?.name) {
        importedNames.push(importClause.name.text);
      }

      if (importClause?.namedBindings) {
        if (importClause.namedBindings.kind === ts.SyntaxKind.NamespaceImport) {
          importedNames.push(`* as ${importClause.namedBindings.name.text}`);
        } else if (importClause.namedBindings.elements) {
          importedNames.push(
            ...importClause.namedBindings.elements.map(e => e.name.text)
          );
        }
      }

      entities.push({
        type: "import",
        name: importedNames.join(", ") || "side-effect",
        module: moduleSpecifier,
        line: lineNumber,
        signature: node.getText().split("\n")[0].trim()
      });
    }

    // Export declarations
    if (isExportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier?.text;
      let exportedNames = [];
      let exportType = "named";

      if (node.exportClause) {
        if (node.exportClause.kind === ts.SyntaxKind.NamespaceExport) {
          // export * as name from 'module'
          exportedNames.push(`* as ${node.exportClause.name.text}`);
          exportType = "namespace";
        } else if (node.exportClause.elements) {
          // export { name1, name2 } from 'module'
          exportedNames.push(
            ...node.exportClause.elements.map(e => {
              const name = e.name.text;
              const propertyName = e.propertyName?.text;
              return propertyName ? `${propertyName} as ${name}` : name;
            })
          );
        }
      } else if (moduleSpecifier) {
        // export * from 'module'
        exportedNames.push("*");
        exportType = "all";
      }

      entities.push({
        type: "export",
        name:
          exportedNames.join(", ") || (moduleSpecifier ? "all exports" : "unknown"),
        module: moduleSpecifier,
        exportType,
        line: lineNumber,
        signature: node.getText().split("\n")[0].trim(),
        isReExport: !!moduleSpecifier
      });
    }

    // Export assignments (export default, export =)
    if (isExportAssignment(node)) {
      const isDefault = !!(node.isExportEquals === false);
      const expression = node.expression;
      let name = "default";

      if (expression.kind === ts.SyntaxKind.Identifier) {
        name = isDefault ? `default (${expression.text})` : expression.text;
      } else {
        name = isDefault ? "default" : "module.exports";
      }

      entities.push({
        type: "export",
        name,
        exportType: isDefault ? "default" : "assignment",
        line: lineNumber,
        signature: node.getText().split("\n")[0].trim(),
        isDefault,
        isReExport: false
      });
    }

    // Variable declarations (const, let, var)
    if (isVariableDeclaration(node)) {
      const name = node.name?.text;
      if (name) {
        entities.push({
          type: "variable",
          name,
          line: lineNumber,
          signature: node.getText().split("\n")[0].trim()
        });
      }
    }

    // Recursively visit child nodes
    node.forEachChild(visit);
  }

  visit(sourceFile);
  return entities;
}

// TypeScript AST node type helpers
function isFunctionDeclaration(node) {
  return node.kind === ts.SyntaxKind.FunctionDeclaration;
}

function isClassDeclaration(node) {
  return node.kind === ts.SyntaxKind.ClassDeclaration;
}

function isInterfaceDeclaration(node) {
  return node.kind === ts.SyntaxKind.InterfaceDeclaration;
}

function isTypeAliasDeclaration(node) {
  return node.kind === ts.SyntaxKind.TypeAliasDeclaration;
}

function isImportDeclaration(node) {
  return node.kind === ts.SyntaxKind.ImportDeclaration;
}

function isVariableDeclaration(node) {
  return node.kind === ts.SyntaxKind.VariableDeclaration;
}

function isExportDeclaration(node) {
  return node.kind === ts.SyntaxKind.ExportDeclaration;
}

function isExportAssignment(node) {
  return node.kind === ts.SyntaxKind.ExportAssignment;
}

// Extract call expressions from TypeScript AST
export function extractCallExpressions(sourceFile: ts.SourceFile): CallExpression[] {
  const callExpressions: CallExpression[] = [];

  function visit(node: ts.Node) {
    if (node.kind === ts.SyntaxKind.CallExpression) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const lineNumber = line + 1;

      let calleeName = "unknown";
      let calleeType = "unknown";

      // Handle different types of call expressions
      if (node.expression.kind === ts.SyntaxKind.Identifier) {
        // Simple function call: foo()
        calleeName = node.expression.text;
        calleeType = "function";
      } else if (node.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
        // Method call: obj.method()
        const object = node.expression.expression.text || "unknown";
        const property = node.expression.name.text;
        calleeName = `${object}.${property}`;
        calleeType = "method";
      } else if (node.expression.kind === ts.SyntaxKind.ElementAccessExpression) {
        // Dynamic call: obj[prop]()
        const object = node.expression.expression.text || "unknown";
        calleeName = `${object}[dynamic]`;
        calleeType = "dynamic";
      }

      // Get the containing function/method if any
      let containingFunction = null;
      let currentNode = node.parent;
      while (currentNode) {
        if (
          isFunctionDeclaration(currentNode) ||
          currentNode.kind === ts.SyntaxKind.MethodDeclaration ||
          currentNode.kind === ts.SyntaxKind.ArrowFunction ||
          currentNode.kind === ts.SyntaxKind.FunctionExpression
        ) {
          containingFunction = currentNode.name?.text || "anonymous";
          break;
        }
        currentNode = currentNode.parent;
      }

      callExpressions.push({
        callee: calleeName,
        type: calleeType,
        line: lineNumber,
        containingFunction,
        signature: node.getText(),
        argumentCount: node.arguments.length
      });
    }

    node.forEachChild(visit);
  }

  visit(sourceFile);
  return callExpressions;
}

// Extract enhanced type information from TypeScript AST
export function extractTypeInformation(sourceFile: ts.SourceFile): TypeInformation {
  const typeInfo: TypeInformation = {
    typeAliases: [],
    interfaces: [],
    classes: [],
    enums: [],
    typeReferences: []
  };

  if (!sourceFile) {
    console.warn("No source file provided to extractTypeInformation");
    return typeInfo;
  }

  function visit(node: ts.Node) {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const lineNumber = line + 1;

    // Type aliases
    if (node.kind === ts.SyntaxKind.TypeAliasDeclaration) {
      const name = node.name.text;
      const typeParameters = node.typeParameters
        ? node.typeParameters.map(tp => tp.name.text)
        : [];

      if (!typeInfo.typeAliases) {
        console.warn("typeInfo.typeAliases is undefined");
        typeInfo.typeAliases = [];
      }
      typeInfo.typeAliases.push({
        name,
        line: lineNumber,
        typeParameters,
        definition: node.type.getText(),
        isExported: !!node.modifiers?.some(
          m => m.kind === ts.SyntaxKind.ExportKeyword
        )
      });
    }

    // Interface declarations with inheritance
    if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
      const name = node.name.text;
      const typeParameters = node.typeParameters
        ? node.typeParameters.map(tp => tp.name.text)
        : [];
      const heritage = node.heritageClauses
        ? node.heritageClauses.flatMap(hc =>
            hc.types.map(t => {
              try {
                return t.expression?.text || t.getText();
              } catch (e) {
                return "unknown";
              }
            })
          )
        : [];

      if (!typeInfo.interfaces) {
        console.warn("typeInfo.interfaces is undefined");
        typeInfo.interfaces = [];
      }
      typeInfo.interfaces.push({
        name,
        line: lineNumber,
        typeParameters,
        extends: heritage,
        properties: node.members.length,
        isExported: !!node.modifiers?.some(
          m => m.kind === ts.SyntaxKind.ExportKeyword
        )
      });
    }

    // Class declarations with inheritance
    if (node.kind === ts.SyntaxKind.ClassDeclaration) {
      const name = node.name?.text || "anonymous";
      const typeParameters = node.typeParameters
        ? node.typeParameters.map(tp => tp.name.text)
        : [];
      const heritage = node.heritageClauses
        ? node.heritageClauses.flatMap(hc =>
            hc.types.map(t => {
              try {
                return t.expression?.text || t.getText();
              } catch (e) {
                return "unknown";
              }
            })
          )
        : [];

      if (!typeInfo.classes) {
        console.warn("typeInfo.classes is undefined");
        typeInfo.classes = [];
      }
      typeInfo.classes.push({
        name,
        line: lineNumber,
        typeParameters,
        extends: heritage.length > 0 ? heritage : [],
        implements: heritage.length > 0 ? heritage : [],
        members: node.members.length,
        isAbstract: !!node.modifiers?.some(
          m => m.kind === ts.SyntaxKind.AbstractKeyword
        ),
        isExported: !!node.modifiers?.some(
          m => m.kind === ts.SyntaxKind.ExportKeyword
        )
      });
    }

    // Enum declarations
    if (node.kind === ts.SyntaxKind.EnumDeclaration) {
      const name = node.name.text;
      if (!typeInfo.enums) {
        console.warn("typeInfo.enums is undefined");
        typeInfo.enums = [];
      }
      typeInfo.enums.push({
        name,
        line: lineNumber,
        members: node.members.length,
        isConst: !!node.modifiers?.some(m => m.kind === ts.SyntaxKind.ConstKeyword),
        isExported: !!node.modifiers?.some(
          m => m.kind === ts.SyntaxKind.ExportKeyword
        )
      });
    }

    node.forEachChild(visit);
  }

  try {
    visit(sourceFile);
  } catch (error) {
    console.warn(`Error in type analysis visit: ${error.message}`);
  }
  return typeInfo;
}
