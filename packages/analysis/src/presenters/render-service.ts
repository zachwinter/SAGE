import { resolve } from "path";
import {
  callTreeCustomizer,
  reverseCallTreeCustomizer
} from "./customizers/call-tree.customizer.js";
import { topologicalTreeCustomizer } from "./customizers/topological-sort.customizer.js";
import { typeAnalysisCustomizer } from "./customizers/type-analysis.customizer.js";
import type {
  CallGraphAnalysisResult,
  TopologicalSortResult,
  TypeAnalysisResult,
  AnalysisOptions,
  RenderData
} from "../types.js";

// Render call tree
export function prepareCallTreeForRender(
  callAnalysis: CallGraphAnalysisResult,
  options: AnalysisOptions = {}
): RenderData {
  const { callGraph, reverseCallGraph, allFunctions } = callAnalysis;
  const direction = String(options.calls) || "both";
  const maxDepth = parseInt(String(options.callDepth)) || 5;

  if (direction === "from") {
    return prepareCallTreeFromFunctions(callGraph);
  } else if (direction === "to") {
    return prepareCallTreeToFunctions(reverseCallGraph);
  } else {
    return prepareFullCallTree(callGraph, reverseCallGraph, allFunctions);
  }
}

// Prepare call tree showing what functions call (outgoing calls)
function prepareCallTreeFromFunctions(callGraph: Map<string, Set<string>>): RenderData {
  const treeData = [];
  for (const [funcId, calls] of callGraph) {
    if (calls.size === 0) continue;

    const [filePath, funcName] = (funcId as string).split(":");
    const callsArray = Array.from(calls).map(callId => {
      const [targetFile, targetFunc] = (callId as string).split(":");
      return {
        name: targetFunc,
        file: targetFile,
        id: callId
      };
    });

    treeData.push({
      name: funcName,
      file: filePath,
      id: funcId,
      calls: callsArray
    });
  }

  return {
    type: "tree",
    data: treeData,
    customizer: callTreeCustomizer(),
    title: `🌳 Call Tree - Outgoing Calls (${treeData.length} functions)`
  };
}

// Prepare call tree showing what calls functions (incoming calls)
function prepareCallTreeToFunctions(reverseCallGraph: Map<string, Set<string>>): RenderData {
  const treeData = [];
  for (const [funcId, callers] of reverseCallGraph) {
    if (callers.size === 0) continue;

    const [filePath, funcName] = (funcId as string).split(":");
    const callersArray = Array.from(callers).map(callerId => {
      const [callerFile, callerFunc] = (callerId as string).split(":");
      return {
        name: callerFunc,
        file: callerFile,
        id: callerId
      };
    });

    treeData.push({
      name: funcName,
      file: filePath,
      id: funcId,
      callers: callersArray
    });
  }

  return {
    type: "tree",
    data: treeData,
    customizer: reverseCallTreeCustomizer(),
    title: `🌳 Call Tree - Incoming Calls (${treeData.length} functions)`
  };
}

// Prepare full call tree
function prepareFullCallTree(
  callGraph: Map<string, Set<string>>,
  reverseCallGraph: Map<string, Set<string>>,
  allFunctions: Set<string>
): RenderData {
  // Group by file for better organization
  const fileGroups = new Map();

  for (const funcId of allFunctions) {
    const [filePath, funcName] = (funcId as string).split(":");
    if (!fileGroups.has(filePath)) {
      fileGroups.set(filePath, []);
    }

    const calls = Array.from(callGraph.get(funcId) || []);
    const callers = Array.from(reverseCallGraph.get(funcId) || []);

    if (calls.length > 0 || callers.length > 0) {
      fileGroups.get(filePath).push({
        name: funcName,
        id: funcId,
        calls: calls.map(id => {
          const [f, n] = (id as string).split(":");
          return { name: n, file: f, id };
        }),
        callers: callers.map(id => {
          const [f, n] = (id as string).split(":");
          return { name: n, file: f, id };
        })
      });
    }
  }

  const treeData = Array.from(fileGroups.entries()).map(([filePath, functions]) => ({
    filePath,
    functions
  }));

  const totalFunctions = Array.from(fileGroups.values()).flat().length;

  return {
    type: "tree",
    data: treeData,
    customizer: callTreeCustomizer(),
    title: `🌳 Full Call Tree (${totalFunctions} functions)`
  };
}

// Prepare topological sort for rendering
export function prepareTopologicalSortForRender(
  sortResult: TopologicalSortResult,
  options: AnalysisOptions = {}
): RenderData {
  const { sorted, cycles } = sortResult;

  if (sorted.length === 0) {
    return {
      type: "empty",
      title: "No entities found for sorting.",
      data: []
    };
  }

  // Use flat display if --flat is specified, otherwise use tree
  if (options.flat) {
    return prepareFlatTopologicalSort(sortResult);
  } else {
    // Build dependency tree structure
    const dependencyTree = buildDependencyTree(sorted, cycles);

    return {
      type: "tree",
      data: dependencyTree,
      customizer: topologicalTreeCustomizer(),
      title: `🔄 Dependency Tree (${sorted.length} entities)`
    };
  }
}

function prepareFlatTopologicalSort(sortResult: any): RenderData {
  const { sorted, cycles } = sortResult;

  const entities = sorted.map((entity: any, index: number) => ({
    ...entity,
    index: index + 1
  }));

  return {
    type: "flat",
    data: {
      entities,
      cycles
    },
    title: `🔄 Topological Sort (${sorted.length} entities)`
  };
}

function buildDependencyTree(sorted: any, cycles: any) {
  // Group entities by dependency level (how many things they depend on)
  const entityMap = new Map();
  const dependencyLevels = new Map();
  const reverseDeps = new Map();

  // Build entity map and reverse dependency tracking
  for (const entity of sorted) {
    entityMap.set(entity.id, entity);
    reverseDeps.set(entity.id, new Set());
  }

  // For simplicity, we'll create a tree based on direct dependencies
  // Root nodes are entities with no dependencies
  // Children are entities that depend on their parent

  const rootNodes = [];
  const processedEntities = new Set();

  // Find root entities (imports and basic entities with no dependencies)
  const imports = sorted.filter((e: any) => e.type === "import");
  const exports = sorted.filter((e: any) => e.type === "export");
  const types = sorted.filter((e: any) => e.type === "type" || e.type === "interface");
  const variables = sorted.filter((e: any) => e.type === "variable");
  const functions = sorted.filter((e: any) => e.type === "function");
  const classes = sorted.filter((e: any) => e.type === "class");

  // Build a simplified tree structure grouped by type
  const treeStructure = [];

  if (imports.length > 0) {
    treeStructure.push({
      type: "group",
      name: "📦 Imports",
      entities: imports,
      children: []
    });
  }

  if (exports.length > 0) {
    treeStructure.push({
      type: "group",
      name: "📤 Exports",
      entities: exports,
      children: []
    });
  }

  if (types.length > 0) {
    treeStructure.push({
      type: "group",
      name: "🔤 Types & Interfaces",
      entities: types,
      children: []
    });
  }

  if (variables.length > 0) {
    treeStructure.push({
      type: "group",
      name: "📊 Variables",
      entities: variables,
      children: []
    });
  }

  if (functions.length > 0) {
    treeStructure.push({
      type: "group",
      name: "🔧 Functions",
      entities: functions,
      children: []
    });
  }

  if (classes.length > 0) {
    treeStructure.push({
      type: "group",
      name: "🏗️ Classes",
      entities: classes,
      children: []
    });
  }

  // Add cycles section if any
  if (cycles.length > 0) {
    treeStructure.push({
      type: "group",
      name: "⚠️ Circular Dependencies",
      entities: cycles,
      children: []
    });
  }

  return treeStructure;
}

// Prepare type analysis for rendering
export function prepareTypeAnalysisForRender(
  typeAnalysis: TypeAnalysisResult
): RenderData {
  const { allTypes, typeRelationships } = typeAnalysis;

  // Group types by kind and file
  const fileGroups = new Map();

  for (const [typeId, typeData] of allTypes) {
    const { filePath } = typeData;
    if (!fileGroups.has(filePath)) {
      fileGroups.set(filePath, {
        interfaces: [],
        classes: [],
        types: [],
        enums: []
      });
    }

    const group = fileGroups.get(filePath);
    const relationships = typeRelationships.get(typeId) || {};

    const typeWithRelationships = {
      ...typeData,
      id: typeId,
      relationships
    };

    group[typeData.kind === "type" ? "types" : `${typeData.kind}s`].push(
      typeWithRelationships
    );
  }

  const treeData = Array.from(fileGroups.entries()).map(([filePath, groups]) => ({
    filePath,
    typeGroups: groups
  }));

  return {
    type: "tree",
    data: treeData,
    customizer: typeAnalysisCustomizer(),
    title: `🔤 Type Analysis (${allTypes.size} types)`
  };
}
