// src/security-policies.ts
// Security policies and approval system for tool calls

import type { ToolCallInfo, ToolSchema } from './types.js';

/**
 * Security policy result
 */
export type PolicyResult = 'approved' | 'denied';

/**
 * Security policy function
 */
export type SecurityPolicy = (
  callInfo: ToolCallInfo,
  toolSchema?: ToolSchema
) => Promise<PolicyResult> | PolicyResult;

/**
 * Policy evaluation context
 */
export interface PolicyContext {
  // Current user/session info
  userId?: string;
  sessionId?: string;
  
  // Tool execution context
  toolName: string;
  arguments: unknown;
  round: number;
  
  // Request context
  requestId?: string;
  timestamp: Date;
  
  // Previous tool calls in this session
  previousCalls?: ToolCallInfo[];
  
  // Rate limiting context
  callsInLastMinute?: number;
  callsInLastHour?: number;
}

/**
 * Policy violation details
 */
export interface PolicyViolation {
  policy: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Enhanced policy result with details
 */
export interface DetailedPolicyResult {
  result: PolicyResult;
  violations?: PolicyViolation[];
  allowedWithWarnings?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Security policy manager
 */
export class SecurityPolicyManager {
  private policies = new Map<string, SecurityPolicy>();
  private allowlist = new Set<string>();
  private denylist = new Set<string>();
  private rateLimit = new Map<string, { count: number; resetTime: number }>();
  private callHistory = new Map<string, ToolCallInfo[]>();

  constructor() {
    // Register built-in security policies
    this.registerBuiltinPolicies();
  }

  /**
   * Register a security policy
   */
  registerPolicy(name: string, policy: SecurityPolicy): void {
    this.policies.set(name, policy);
  }

  /**
   * Remove a security policy
   */
  removePolicy(name: string): boolean {
    return this.policies.delete(name);
  }

  /**
   * Get all registered policies
   */
  getPolicies(): string[] {
    return Array.from(this.policies.keys());
  }

  /**
   * Add tools to allowlist (bypass most security checks)
   */
  addToAllowlist(toolNames: string[]): void {
    for (const tool of toolNames) {
      this.allowlist.add(tool);
    }
  }

  /**
   * Add tools to denylist (always deny)
   */
  addToDenylist(toolNames: string[]): void {
    for (const tool of toolNames) {
      this.denylist.add(tool);
    }
  }

  /**
   * Remove tools from allowlist
   */
  removeFromAllowlist(toolNames: string[]): void {
    for (const tool of toolNames) {
      this.allowlist.delete(tool);
    }
  }

  /**
   * Remove tools from denylist
   */
  removeFromDenylist(toolNames: string[]): void {
    for (const tool of toolNames) {
      this.denylist.delete(tool);
    }
  }

  /**
   * Evaluate all policies for a tool call
   */
  async evaluateToolCall(
    callInfo: ToolCallInfo,
    context: Partial<PolicyContext> = {},
    toolSchema?: ToolSchema
  ): Promise<DetailedPolicyResult> {
    const policyContext: PolicyContext = {
      userId: context.userId,
      sessionId: context.sessionId || 'default',
      toolName: callInfo.name,
      arguments: callInfo.args,
      round: callInfo.round,
      requestId: context.requestId,
      timestamp: new Date(),
      previousCalls: this.callHistory.get(context.sessionId || 'default') || [],
      callsInLastMinute: this.getRateLimit(context.sessionId || 'default', 60 * 1000),
      callsInLastHour: this.getRateLimit(context.sessionId || 'default', 60 * 60 * 1000),
      ...context
    };

    const violations: PolicyViolation[] = [];
    
    // Check denylist first (highest priority)
    if (this.denylist.has(callInfo.name)) {
      violations.push({
        policy: 'denylist',
        severity: 'critical',
        message: `Tool '${callInfo.name}' is in the denylist`
      });
      
      return {
        result: 'denied',
        violations
      };
    }

    // Check allowlist (skip most other policies)
    if (this.allowlist.has(callInfo.name)) {
      this.recordToolCall(policyContext.sessionId, callInfo);
      return {
        result: 'approved',
        metadata: { allowlisted: true }
      };
    }

    // Evaluate all registered policies
    for (const [policyName, policy] of this.policies) {
      try {
        const result = await policy(callInfo, toolSchema);
        
        if (result === 'denied') {
          violations.push({
            policy: policyName,
            severity: 'high',
            message: `Policy '${policyName}' denied the tool call`
          });
        }
      } catch (error) {
        violations.push({
          policy: policyName,
          severity: 'medium',
          message: `Policy '${policyName}' failed to evaluate`,
          details: { error: error instanceof Error ? error.message : String(error) }
        });
      }
    }

    // Determine final result
    const criticalViolations = violations.filter(v => v.severity === 'critical');
    const highViolations = violations.filter(v => v.severity === 'high');

    if (criticalViolations.length > 0 || highViolations.length > 0) {
      return {
        result: 'denied',
        violations
      };
    }

    // Record successful tool call
    this.recordToolCall(policyContext.sessionId, callInfo);

    return {
      result: 'approved',
      violations: violations.length > 0 ? violations : undefined,
      allowedWithWarnings: violations.length > 0
    };
  }

  /**
   * Create a simple policy function for use with ToolValidator
   */
  createPolicyFunction(context: Partial<PolicyContext> = {}): (callInfo: ToolCallInfo) => Promise<PolicyResult> {
    return async (callInfo: ToolCallInfo): Promise<PolicyResult> => {
      const result = await this.evaluateToolCall(callInfo, context);
      return result.result;
    };
  }

  /**
   * Record a tool call for rate limiting and history
   */
  private recordToolCall(sessionId: string, callInfo: ToolCallInfo): void {
    // Update call history
    const history = this.callHistory.get(sessionId) || [];
    history.push(callInfo);
    
    // Keep only last 100 calls per session
    if (history.length > 100) {
      history.shift();
    }
    
    this.callHistory.set(sessionId, history);

    // Update rate limiting
    const now = Date.now();
    const rateKey = `${sessionId}:${callInfo.name}`;
    const current = this.rateLimit.get(rateKey);
    
    if (current && current.resetTime > now) {
      current.count++;
    } else {
      this.rateLimit.set(rateKey, {
        count: 1,
        resetTime: now + 60 * 1000 // Reset after 1 minute
      });
    }
  }

  /**
   * Get rate limit count for a session
   */
  private getRateLimit(sessionId: string, windowMs: number): number {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    let count = 0;
    for (const [key, data] of this.rateLimit) {
      if (key.startsWith(`${sessionId}:`) && data.resetTime > windowStart) {
        count += data.count;
      }
    }
    
    return count;
  }

  /**
   * Register built-in security policies
   */
  private registerBuiltinPolicies(): void {
    // Rate limiting policy
    this.registerPolicy('rate_limit', (callInfo, _schema) => {
      const sessionId = 'default'; // Would get from context in real implementation
      const callsPerMinute = this.getRateLimit(sessionId, 60 * 1000);
      const callsPerHour = this.getRateLimit(sessionId, 60 * 60 * 1000);
      
      if (callsPerMinute > 10) {
        return 'denied'; // More than 10 calls per minute
      }
      
      if (callsPerHour > 100) {
        return 'denied'; // More than 100 calls per hour
      }
      
      return 'approved';
    });

    // Argument size policy
    this.registerPolicy('argument_size', (callInfo, _schema) => {
      const argsString = JSON.stringify(callInfo.args);
      
      if (argsString.length > 100 * 1024) { // 100KB limit
        return 'denied';
      }
      
      return 'approved';
    });

    // Dangerous content policy
    this.registerPolicy('dangerous_content', (callInfo, _schema) => {
      const argsString = JSON.stringify(callInfo.args).toLowerCase();
      
      const dangerousPatterns = [
        /\beval\b/,
        /\bexec\b/,
        /\bsystem\b/,
        /\bprocess\b/,
        /\bshell\b/,
        /\bcommand\b/,
        /<script/,
        /javascript:/,
        /file:\/\//,
        /\.\.\//, // Path traversal
        /\/etc\/passwd/,
        /\/proc\/self/
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(argsString)) {
          return 'denied';
        }
      }
      
      return 'approved';
    });

    // Tool name validation policy
    this.registerPolicy('tool_name_validation', (callInfo, _schema) => {
      const toolName = callInfo.name;
      
      // Tool name must be alphanumeric with underscores/hyphens
      if (!/^[a-zA-Z0-9_-]+$/.test(toolName)) {
        return 'denied';
      }
      
      // Tool name length limit
      if (toolName.length > 64) {
        return 'denied';
      }
      
      return 'approved';
    });

    // Nested depth policy
    this.registerPolicy('nested_depth', (callInfo, _schema) => {
      const depth = this.getObjectDepth(callInfo.args);
      
      if (depth > 10) {
        return 'denied';
      }
      
      return 'approved';
    });
  }

  /**
   * Calculate the depth of nested objects/arrays
   */
  private getObjectDepth(obj: unknown, currentDepth = 0): number {
    if (obj === null || typeof obj !== 'object') {
      return currentDepth;
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return currentDepth + 1;
      return Math.max(
        ...obj.map(item => this.getObjectDepth(item, currentDepth + 1))
      );
    }

    const keys = Object.keys(obj);
    if (keys.length === 0) return currentDepth + 1;
    
    return Math.max(
      ...keys.map(key => this.getObjectDepth((obj as Record<string, unknown>)[key], currentDepth + 1))
    );
  }
}

/**
 * Built-in security policies
 */
export const BuiltinPolicies = {
  /**
   * Allow specific tools only
   */
  allowOnly: (allowedTools: string[]): SecurityPolicy => {
    const allowed = new Set(allowedTools);
    return (callInfo) => allowed.has(callInfo.name) ? 'approved' : 'denied';
  },

  /**
   * Deny specific tools
   */
  denyTools: (deniedTools: string[]): SecurityPolicy => {
    const denied = new Set(deniedTools);
    return (callInfo) => denied.has(callInfo.name) ? 'denied' : 'approved';
  },

  /**
   * Require specific argument properties
   */
  requireArguments: (requiredProps: string[]): SecurityPolicy => {
    return (callInfo) => {
      if (!callInfo.args || typeof callInfo.args !== 'object') {
        return 'denied';
      }
      
      const args = callInfo.args as Record<string, unknown>;
      
      for (const prop of requiredProps) {
        if (!(prop in args)) {
          return 'denied';
        }
      }
      
      return 'approved';
    };
  },

  /**
   * Time-based policy (only allow during certain hours)
   */
  timeWindow: (startHour: number, endHour: number): SecurityPolicy => {
    return () => {
      const now = new Date();
      const hour = now.getHours();
      
      if (startHour <= endHour) {
        return (hour >= startHour && hour <= endHour) ? 'approved' : 'denied';
      } else {
        // Overnight window (e.g., 22:00 to 06:00)
        return (hour >= startHour || hour <= endHour) ? 'approved' : 'denied';
      }
    };
  },

  /**
   * User-based policy
   */
  requireUser: (allowedUsers: string[]): SecurityPolicy => {
    const allowed = new Set(allowedUsers);
    return (callInfo, _schema) => {
      // In a real implementation, you'd get the current user from context
      // For now, this is a placeholder
      const currentUser = 'anonymous';
      return allowed.has(currentUser) ? 'approved' : 'denied';
    };
  }
};

/**
 * Default global security policy manager
 */
export const defaultSecurityPolicyManager = new SecurityPolicyManager();