import type { GraphAdapter } from "./types.js";

interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
  first_seen: string;
  last_seen?: string;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  properties: Record<string, any>;
  first_seen: string;
  last_seen?: string;
}

/**
 * In-memory Graph adapter with MVCC-lite commit tracking
 * Supports basic Cypher patterns for testing
 */
export class TestGraphAdapter implements GraphAdapter {
  private nodes = new Map<string, GraphNode>();
  private edges = new Map<string, GraphEdge>();
  private nodeIdCounter = 1;
  private edgeIdCounter = 1;

  async query<T>(cypher: string, params: Record<string, unknown> = {}): Promise<T[]> {
    try {
      // Extract commit context from query hint if present
      const commitMatch = cypher.match(/\/\*\s*@commit:\s*([A-Za-z0-9]+)\s*\*\//);
      const targetCommit = commitMatch?.[1];

      // Parse basic MATCH patterns
      const matchPattern = this.parseMatchPattern(cypher);
      if (!matchPattern) {
        return []; // Unsupported query pattern
      }

      const results = this.executeMatch(matchPattern, params, targetCommit);
      return results as T[];
    } catch (error) {
      console.warn(`Graph query failed: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Ingest data into the graph (for testing setup)
   */
  async ingest(data: {
    file?: string;
    defines?: string[];
    calls?: string[];
    commit: string;
    timestamp?: string;
  }): Promise<void> {
    const timestamp = data.timestamp || new Date().toISOString();

    if (data.file) {
      // Create File node
      const fileNode: GraphNode = {
        id: `file:${this.nodeIdCounter++}`,
        labels: ["File"],
        properties: {
          path: data.file,
          commit: data.commit,
        },
        first_seen: data.commit,
      };
      this.nodes.set(fileNode.id, fileNode);

      // Create Function nodes for defines
      if (data.defines) {
        for (const fn of data.defines) {
          const fnNode: GraphNode = {
            id: `fn:${this.nodeIdCounter++}`,
            labels: ["Function"],
            properties: {
              name: fn,
              filePath: data.file,
              commit: data.commit,
            },
            first_seen: data.commit,
          };
          this.nodes.set(fnNode.id, fnNode);

          // Create DEFINES relationship
          const edge: GraphEdge = {
            id: `edge:${this.edgeIdCounter++}`,
            from: fileNode.id,
            to: fnNode.id,
            type: "DEFINES",
            properties: { commit: data.commit },
            first_seen: data.commit,
          };
          this.edges.set(edge.id, edge);
        }
      }

      // Create CALLS relationships
      if (data.calls) {
        for (const call of data.calls) {
          // Find or create target function node
          let targetNode = this.findNodeByName(call, "Function");
          if (!targetNode) {
            targetNode = {
              id: `fn:${this.nodeIdCounter++}`,
              labels: ["Function"],
              properties: {
                name: call,
                commit: data.commit,
              },
              first_seen: data.commit,
            };
            this.nodes.set(targetNode.id, targetNode);
          }

          // Create CALLS relationship from file to function
          const edge: GraphEdge = {
            id: `edge:${this.edgeIdCounter++}`,
            from: fileNode.id,
            to: targetNode.id,
            type: "CALLS",
            properties: { commit: data.commit },
            first_seen: data.commit,
          };
          this.edges.set(edge.id, edge);
        }
      }
    }
  }

  private parseMatchPattern(cypher: string): {
    nodeVar: string;
    labels: string[];
    where?: Record<string, any>;
    returns: string[];
  } | null {
    // Simple MATCH (n:Label {prop: $param}) RETURN n pattern
    const basicMatch = cypher.match(
      /MATCH\s+\((\w+):(\w+)(?:\s+\{([^}]+)\})?\)\s+RETURN\s+(.+)/i
    );

    if (basicMatch) {
      const [, nodeVar, label, whereClause, returnClause] = basicMatch;
      
      const where: Record<string, any> = {};
      if (whereClause) {
        // Parse simple property constraints like "path: $p"
        const props = whereClause.split(',');
        for (const prop of props) {
          const [key, value] = prop.split(':').map(s => s.trim());
          if (value?.startsWith('$')) {
            where[key] = value.substring(1);
          } else if (value) {
            where[key] = value.replace(/['"]/g, '');
          }
        }
      }

      return {
        nodeVar,
        labels: [label],
        where,
        returns: returnClause.split(',').map(s => s.trim()),
      };
    }

    return null;
  }

  private executeMatch(
    pattern: {
      nodeVar: string;
      labels: string[];
      where?: Record<string, any>;
      returns: string[];
    },
    params: Record<string, unknown>,
    targetCommit?: string
  ): any[] {
    const results: any[] = [];

    for (const node of this.nodes.values()) {
      // Check if node is visible at target commit
      if (targetCommit && !this.isNodeVisibleAtCommit(node, targetCommit)) {
        continue;
      }

      // Check label match
      if (!pattern.labels.some(label => node.labels.includes(label))) {
        continue;
      }

      // Check WHERE constraints
      let matches = true;
      if (pattern.where) {
        for (const [key, paramName] of Object.entries(pattern.where)) {
          const expectedValue = typeof paramName === 'string' && paramName in params 
            ? params[paramName]
            : paramName;
          
          if (node.properties[key] !== expectedValue) {
            matches = false;
            break;
          }
        }
      }

      if (matches) {
        // Build result object based on RETURN clause
        if (pattern.returns.includes(pattern.nodeVar)) {
          results.push({
            id: node.id,
            labels: node.labels,
            properties: node.properties,
          });
        }
      }
    }

    return results;
  }

  private findNodeByName(name: string, label: string): GraphNode | null {
    for (const node of this.nodes.values()) {
      if (node.labels.includes(label) && node.properties.name === name) {
        return node;
      }
    }
    return null;
  }

  private isNodeVisibleAtCommit(node: GraphNode, commit: string): boolean {
    // Simple commit ordering - in real impl would use proper git ancestry
    return node.first_seen <= commit && (
      !node.last_seen || node.last_seen > commit
    );
  }

  /**
   * Get all nodes for inspection (testing utility)
   */
  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all edges for inspection (testing utility)
   */
  getAllEdges(): GraphEdge[] {
    return Array.from(this.edges.values());
  }

  /**
   * Clear all data (testing utility)
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.nodeIdCounter = 1;
    this.edgeIdCounter = 1;
  }
}

/**
 * Factory function matching CONTRACT.md specification
 */
export function makeGraphAdapter(): GraphAdapter {
  return new TestGraphAdapter();
}