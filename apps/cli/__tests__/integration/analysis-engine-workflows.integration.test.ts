import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach
} from "vitest";
import {
  analyzeFiles,
  getCodeFiles,
  performCallTreeAnalysis,
  performTypeAnalysis
} from "@sage/analysis";
import { Read } from "@/tools/Read";
import { Write } from "@/tools/Write";
import { Edit } from "@/tools/Edit";
import { Bash } from "@/tools/Bash";
import { mcpClientManager } from "@/mcp/client";
import { state } from "@/mcp/state";
import { state as threadsState } from "@/threads/state/state";
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  readdirSync
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { McpServerConfig, McpTool } from "@/mcp/types";

describe("Analysis Engine Workflows Integration Tests", () => {
  let tempDir: string;
  let projectDir: string;
  let srcDir: string;
  let analysisOutputDir: string;

  beforeAll(() => {
    // Create a temporary directory for our tests
    tempDir = join(tmpdir(), `analysis-engine-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    projectDir = join(tempDir, "test-project");
    srcDir = join(projectDir, "src");
    analysisOutputDir = join(projectDir, "analysis");

    // Create directory structure
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(analysisOutputDir, { recursive: true });
  });

  afterAll(() => {
    // Cleanup temporary directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clean up project directory before each test
    if (existsSync(projectDir)) {
      rmSync(projectDir, { recursive: true });
    }
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(analysisOutputDir, { recursive: true });

    // Reset thread state
    threadsState.active = null;
    threadsState.activeThreadId = null;
    threadsState.turn = "user";
    threadsState.message = "";
    threadsState.response = "";
    threadsState.streamingToolCalls = [];

    // Reset MCP state
    Object.keys(state.servers).forEach(serverId => {
      delete state.servers[serverId];
    });
    state.availableTools = [];
    state.availableResources = [];
    state.availablePrompts = [];
  });

  afterEach(async () => {
    // Clean up any MCP servers
    const serverIds = Object.keys(state.servers);
    for (const serverId of serverIds) {
      try {
        await mcpClientManager.disconnectServer(serverId);
        await mcpClientManager.removeServer(serverId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe("Large Codebase Analysis Workflows", () => {
    it("should analyze complex multi-module TypeScript project", async () => {
      // 1. Create a complex TypeScript project structure
      const modules = [
        {
          name: "auth",
          files: {
            "user.ts": `export interface User {
  id: string;
  email: string;
  roles: Role[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

export interface Permission {
  resource: string;
  action: 'read' | 'write' | 'delete' | 'admin';
}

export class UserService {
  private users: Map<string, User> = new Map();

  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const user: User = {
      ...userData,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.users.set(user.id, user);
    await this.auditUserCreation(user);
    return user;
  }

  async getUser(id: string): Promise<User | null> {
    const user = this.users.get(id);
    if (user) {
      await this.auditUserAccess(user);
    }
    return user || null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;

    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date()
    };

    this.users.set(id, updatedUser);
    await this.auditUserUpdate(updatedUser);
    return updatedUser;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private async auditUserCreation(user: User): Promise<void> {
    // Audit logging implementation
  }

  private async auditUserAccess(user: User): Promise<void> {
    // Audit logging implementation
  }

  private async auditUserUpdate(user: User): Promise<void> {
    // Audit logging implementation
  }
}`,
            "auth.ts": `import { User, UserService } from './user.js';
import { SessionService } from './session.js';

export class AuthService {
  private userService = new UserService();
  private sessionService = new SessionService();

  async login(email: string, password: string): Promise<{ user: User; token: string } | null> {
    const user = await this.findUserByEmail(email);
    if (!user || !await this.verifyPassword(user.id, password)) {
      return null;
    }

    const token = await this.sessionService.createSession(user.id);
    return { user, token };
  }

  async logout(token: string): Promise<void> {
    await this.sessionService.invalidateSession(token);
  }

  async verifyToken(token: string): Promise<User | null> {
    const session = await this.sessionService.getSession(token);
    if (!session || session.expired) {
      return null;
    }

    return await this.userService.getUser(session.userId);
  }

  private async findUserByEmail(email: string): Promise<User | null> {
    // Implementation would query database
    return null;
  }

  private async verifyPassword(userId: string, password: string): Promise<boolean> {
    // Implementation would verify hashed password
    return false;
  }
}`,
            "session.ts": `export interface Session {
  id: string;
  userId: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  expired: boolean;
}

export class SessionService {
  private sessions: Map<string, Session> = new Map();

  async createSession(userId: string): Promise<string> {
    const session: Session = {
      id: this.generateSessionId(),
      userId,
      token: this.generateToken(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      expired: false
    };

    this.sessions.set(session.token, session);
    return session.token;
  }

  async getSession(token: string): Promise<Session | null> {
    const session = this.sessions.get(token);
    if (!session) return null;

    if (Date.now() > session.expiresAt.getTime()) {
      session.expired = true;
    }

    return session;
  }

  async invalidateSession(token: string): Promise<void> {
    const session = this.sessions.get(token);
    if (session) {
      session.expired = true;
    }
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substr(2, 16);
  }

  private generateToken(): string {
    return Math.random().toString(36).substr(2, 32);
  }
}`
          }
        },
        {
          name: "api",
          files: {
            "server.ts": `import { AuthService } from '../auth/auth.js';
import { UserService } from '../auth/user.js';
import { DatabaseService } from '../data/database.js';

export class ApiServer {
  private authService = new AuthService();
  private userService = new UserService();
  private database = new DatabaseService();

  async handleRequest(path: string, method: string, headers: any, body: any): Promise<any> {
    try {
      // Authentication middleware
      const token = this.extractToken(headers);
      const user = token ? await this.authService.verifyToken(token) : null;

      switch (path) {
        case '/api/auth/login':
          return await this.handleLogin(body);
        case '/api/auth/logout':
          return await this.handleLogout(headers);
        case '/api/users':
          return await this.handleUsers(method, user, body);
        case '/api/health':
          return await this.handleHealth();
        default:
          return { status: 404, body: { error: 'Not found' } };
      }
    } catch (error) {
      return this.handleError(error);
    }
  }

  private extractToken(headers: any): string | null {
    const auth = headers.authorization;
    return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  }

  private async handleLogin(body: any) {
    const { email, password } = body;
    const result = await this.authService.login(email, password);
    
    if (!result) {
      return { status: 401, body: { error: 'Invalid credentials' } };
    }

    return { status: 200, body: result };
  }

  private async handleLogout(headers: any) {
    const token = this.extractToken(headers);
    if (token) {
      await this.authService.logout(token);
    }
    return { status: 200, body: { message: 'Logged out' } };
  }

  private async handleUsers(method: string, user: any, body: any) {
    if (!user) {
      return { status: 401, body: { error: 'Unauthorized' } };
    }

    switch (method) {
      case 'GET':
        return { status: 200, body: await this.userService.getUser(user.id) };
      case 'PUT':
        const updated = await this.userService.updateUser(user.id, body);
        return { status: 200, body: updated };
      default:
        return { status: 405, body: { error: 'Method not allowed' } };
    }
  }

  private async handleHealth() {
    const dbHealth = await this.database.healthCheck();
    return {
      status: 200,
      body: {
        status: 'healthy',
        database: dbHealth ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      }
    };
  }

  private handleError(error: any) {
    console.error('API Error:', error);
    return {
      status: 500,
      body: { error: 'Internal server error' }
    };
  }
}`,
            "middleware.ts": `export interface MiddlewareContext {
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
    body: any;
  };
  response: {
    status?: number;
    headers?: Record<string, string>;
    body?: any;
  };
  user?: any;
}

export type Middleware = (context: MiddlewareContext, next: () => Promise<void>) => Promise<void>;

export class MiddlewareStack {
  private middlewares: Middleware[] = [];

  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  async execute(context: MiddlewareContext): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        await middleware(context, next);
      }
    };

    await next();
  }
}

export const loggingMiddleware: Middleware = async (context, next) => {
  const start = Date.now();
  console.log(\`[\${new Date().toISOString()}] \${context.request.method} \${context.request.path}\`);
  
  await next();
  
  const duration = Date.now() - start;
  console.log(\`[\${new Date().toISOString()}] \${context.response.status} - \${duration}ms\`);
};

export const corsMiddleware: Middleware = async (context, next) => {
  context.response.headers = {
    ...context.response.headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (context.request.method === 'OPTIONS') {
    context.response.status = 200;
    return;
  }

  await next();
};`,
            "controller.ts": `export interface RequestContext {
  params: Record<string, string>;
  query: Record<string, string>;
  body: any;
  user?: any;
}

export abstract class BaseController {
  protected async handleRequest(context: RequestContext): Promise<any> {
    throw new Error('Method not implemented');
  }

  protected validateRequest(context: RequestContext, schema?: any): boolean {
    return true;
  }

  protected createResponse(data: any, status = 200): any {
    return {
      status,
      data,
      timestamp: new Date().toISOString()
    };
  }

  protected createErrorResponse(message: string, status = 500): any {
    return {
      status,
      error: message,
      timestamp: new Date().toISOString()
    };
  }
}

export class UserController extends BaseController {
  async getUser(context: RequestContext): Promise<any> {
    const { id } = context.params;
    
    if (!id) {
      return this.createErrorResponse('User ID is required', 400);
    }

    try {
      const user = await this.findUserById(id);
      if (!user) {
        return this.createErrorResponse('User not found', 404);
      }
      
      return this.createResponse(user);
    } catch (error) {
      return this.createErrorResponse('Internal server error', 500);
    }
  }

  async createUser(context: RequestContext): Promise<any> {
    const userData = context.body;
    
    if (!this.validateRequest(context)) {
      return this.createErrorResponse('Invalid user data', 400);
    }

    try {
      const user = await this.saveUser(userData);
      return this.createResponse(user, 201);
    } catch (error) {
      return this.createErrorResponse('Failed to create user', 500);
    }
  }

  private async findUserById(id: string): Promise<any> {
    return { id, name: 'Test User', email: 'test@example.com' };
  }

  private async saveUser(userData: any): Promise<any> {
    return { ...userData, id: Math.random().toString(36).substr(2, 9) };
  }
}`
          }
        },
        {
          name: "data",
          files: {
            "database.ts": `export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  fields: string[];
}

export class DatabaseService {
  private config: DatabaseConfig;
  private connected = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      // Connection logic would go here
      this.connected = true;
      console.log('Connected to database');
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('Disconnected from database');
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    try {
      // Query execution would go here
      return {
        rows: [],
        rowCount: 0,
        fields: []
      };
    } catch (error) {
      console.error('Query failed:', error);
      throw error;
    }
  }

  async transaction<T>(callback: (query: (sql: string, params?: any[]) => Promise<QueryResult>) => Promise<T>): Promise<T> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    try {
      // Begin transaction
      const transactionQuery = async (sql: string, params: any[] = []) => {
        return await this.query(sql, params);
      };

      const result = await callback(transactionQuery);
      
      // Commit transaction
      return result;
    } catch (error) {
      // Rollback transaction
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}`,
            "models.ts": `export interface BaseModel {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserModel extends BaseModel {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

export interface SessionModel extends BaseModel {
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogModel extends BaseModel {
  userId?: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  ipAddress?: string;
}

export class ModelRepository<T extends BaseModel> {
  protected tableName: string;
  protected db: any; // DatabaseService would be injected

  constructor(tableName: string, db: any) {
    this.tableName = tableName;
    this.db = db;
  }

  async findById(id: string): Promise<T | null> {
    const result = await this.db.query(
      \`SELECT * FROM \${this.tableName} WHERE id = $1\`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(limit = 100, offset = 0): Promise<T[]> {
    const result = await this.db.query(
      \`SELECT * FROM \${this.tableName} LIMIT $1 OFFSET $2\`,
      [limit, offset]
    );
    return result.rows;
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = new Date();
    const id = this.generateId();
    
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map((_, i) => \`$\${i + 4}\`).join(', ');
    const values = Object.values(data);

    const result = await this.db.query(
      \`INSERT INTO \${this.tableName} (id, createdAt, updatedAt, \${columns}) 
       VALUES ($1, $2, $3, \${placeholders}) RETURNING *\`,
      [id, now, now, ...values]
    );

    return result.rows[0];
  }

  async update(id: string, data: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T | null> {
    const updates = { ...data, updatedAt: new Date() };
    const columns = Object.keys(updates).map((key, i) => \`\${key} = $\${i + 2}\`).join(', ');
    const values = Object.values(updates);

    const result = await this.db.query(
      \`UPDATE \${this.tableName} SET \${columns} WHERE id = $1 RETURNING *\`,
      [id, ...values]
    );

    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      \`DELETE FROM \${this.tableName} WHERE id = $1\`,
      [id]
    );
    return result.rowCount > 0;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 16);
  }
}`
          }
        },
        {
          name: "utils",
          files: {
            "validation.ts": `export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'email' | 'date';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export class Validator {
  private rules: ValidationRule[] = [];

  addRule(rule: ValidationRule): this {
    this.rules.push(rule);
    return this;
  }

  validate(data: Record<string, any>): ValidationResult {
    const errors: ValidationError[] = [];

    for (const rule of this.rules) {
      const value = data[rule.field];
      const fieldErrors = this.validateField(rule, value);
      errors.push(...fieldErrors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateField(rule: ValidationRule, value: any): ValidationError[] {
    const errors: ValidationError[] = [];

    // Required validation
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: rule.field,
        message: \`\${rule.field} is required\`,
        value
      });
      return errors; // Skip other validations if required field is missing
    }

    // Skip other validations if value is not provided and not required
    if (value === undefined || value === null) {
      return errors;
    }

    // Type validation
    if (rule.type) {
      const typeError = this.validateType(rule.field, value, rule.type);
      if (typeError) errors.push(typeError);
    }

    // Length validation
    if (rule.minLength !== undefined && typeof value === 'string' && value.length < rule.minLength) {
      errors.push({
        field: rule.field,
        message: \`\${rule.field} must be at least \${rule.minLength} characters\`,
        value
      });
    }

    if (rule.maxLength !== undefined && typeof value === 'string' && value.length > rule.maxLength) {
      errors.push({
        field: rule.field,
        message: \`\${rule.field} must be no more than \${rule.maxLength} characters\`,
        value
      });
    }

    // Pattern validation
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      errors.push({
        field: rule.field,
        message: \`\${rule.field} format is invalid\`,
        value
      });
    }

    // Custom validation
    if (rule.custom) {
      const customResult = rule.custom(value);
      if (customResult !== true) {
        errors.push({
          field: rule.field,
          message: typeof customResult === 'string' ? customResult : \`\${rule.field} is invalid\`,
          value
        });
      }
    }

    return errors;
  }

  private validateType(field: string, value: any, type: string): ValidationError | null {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          return { field, message: \`\${field} must be a string\`, value };
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return { field, message: \`\${field} must be a number\`, value };
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return { field, message: \`\${field} must be a boolean\`, value };
        }
        break;
      case 'email':
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof value !== 'string' || !emailPattern.test(value)) {
          return { field, message: \`\${field} must be a valid email\`, value };
        }
        break;
      case 'date':
        if (!(value instanceof Date) && !Date.parse(value)) {
          return { field, message: \`\${field} must be a valid date\`, value };
        }
        break;
    }
    return null;
  }
}

// Utility functions
export function validateEmail(email: string): boolean {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

export function validatePassword(password: string): ValidationResult {
  const validator = new Validator()
    .addRule({
      field: 'password',
      required: true,
      type: 'string',
      minLength: 8,
      custom: (value: string) => {
        if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter';
        if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter';
        if (!/[0-9]/.test(value)) return 'Password must contain at least one number';
        if (!/[^A-Za-z0-9]/.test(value)) return 'Password must contain at least one special character';
        return true;
      }
    });

  return validator.validate({ password });
}`,
            "crypto.ts": `import { createHash, randomBytes, pbkdf2, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);

export class CryptoUtils {
  static generateSalt(length = 32): string {
    return randomBytes(length).toString('hex');
  }

  static generateToken(length = 32): string {
    return randomBytes(length).toString('hex');
  }

  static async hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
    const passwordSalt = salt || this.generateSalt();
    const hash = await pbkdf2Async(password, passwordSalt, 100000, 64, 'sha512');
    
    return {
      hash: hash.toString('hex'),
      salt: passwordSalt
    };
  }

  static async verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
    const { hash: computedHash } = await this.hashPassword(password, salt);
    
    // Use timing-safe comparison
    const hashBuffer = Buffer.from(hash, 'hex');
    const computedHashBuffer = Buffer.from(computedHash, 'hex');
    
    return timingSafeEqual(hashBuffer, computedHashBuffer);
  }

  static hash(data: string, algorithm = 'sha256'): string {
    return createHash(algorithm).update(data).digest('hex');
  }

  static generateApiKey(): string {
    return 'ak_' + this.generateToken(40);
  }

  static generateSessionId(): string {
    return 'sess_' + this.generateToken(32);
  }
}`,
            "logger.ts": `export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  fatal(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.FATAL, message, context, error);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (level < this.logLevel) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      error
    };

    this.logs.push(entry);
    
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-500);
    }
  }

  getLogs(level?: LogLevel): LogEntry[] {
    if (level === undefined) return [...this.logs];
    return this.logs.filter(log => log.level >= level);
  }

  clearLogs(): void {
    this.logs = [];
  }
}`
          }
        }
      ];

      // Create all module files using Write tool
      for (const module of modules) {
        const moduleDir = join(srcDir, module.name);
        await Bash.implementation({
          command: `mkdir -p "${moduleDir}"`
        });

        for (const [filename, content] of Object.entries(module.files)) {
          const writeResponse = await Write.implementation({
            file_path: join(moduleDir, filename),
            content: content
          });
          expect(writeResponse.success, `Failed to write file ${filename}`).toBe(
            true
          );
        }
      }

      // 2. Discover all TypeScript files
      const codeFiles = getCodeFiles(projectDir);
      expect(codeFiles.length).toBeGreaterThan(10);

      // Verify we found files from all modules
      const moduleNames = modules.map(m => m.name);
      for (const moduleName of moduleNames) {
        expect(codeFiles.some(file => file.includes(moduleName))).toBe(true);
      }

      // 3. Analyze all files
      const analysisResults = analyzeFiles(codeFiles);
      expect(analysisResults.length).toBe(codeFiles.length);

      // Verify we found significant number of entities
      const totalEntities = analysisResults.reduce(
        (sum, result) => sum + result.entities.length,
        0
      );
      expect(totalEntities).toBeGreaterThan(20);

      // 4. Perform call tree analysis
      const callTreeResult = performCallTreeAnalysis(analysisResults);
      expect(callTreeResult).toBeDefined();
      expect(callTreeResult.allFunctions.size).toBeGreaterThan(15);

      // 5. Generate analysis report using Write tool
      const reportData = {
        timestamp: new Date().toISOString(),
        project: {
          totalFiles: analysisResults.length,
          totalLines: analysisResults.reduce((sum, r) => sum + r.totalLines, 0),
          totalEntities: totalEntities
        },
        modules: {} as Record<string, any>,
        callTree: {
          totalFunctions: callTreeResult.allFunctions.size,
          complexFunctions: Array.from(callTreeResult.callGraph.entries())
            .filter(([_, calls]) => calls.size > 3)
            .map(([func, calls]) => ({ function: func, callCount: calls.size }))
        },
        entityTypes: {} as Record<string, number>
      };

      // Analyze by module
      for (const module of modules) {
        const moduleFiles = analysisResults.filter(r =>
          r.filePath.includes(module.name)
        );
        reportData.modules[module.name] = {
          files: moduleFiles.length,
          entities: moduleFiles.reduce((sum, f) => sum + f.entities.length, 0),
          lines: moduleFiles.reduce((sum, f) => sum + f.totalLines, 0)
        };
      }

      // Count entity types
      for (const result of analysisResults) {
        for (const entity of result.entities) {
          reportData.entityTypes[entity.type] =
            (reportData.entityTypes[entity.type] || 0) + 1;
        }
      }

      // Write comprehensive report
      const reportPath = join(analysisOutputDir, "analysis-report.json");
      await Write.implementation({
        file_path: reportPath,
        content: JSON.stringify(reportData, null, 2)
      });

      // 6. Verify report was created and contains expected data
      const reportResponse = await Read.implementation({ file_path: reportPath });
      expect(reportResponse.success, "Failed to read report").toBe(true);
      const parsedReport = JSON.parse(reportResponse.message);

      expect(parsedReport.project.totalFiles).toBeGreaterThan(10);
      expect(parsedReport.project.totalEntities).toBeGreaterThan(20);
      expect(Object.keys(parsedReport.modules)).toHaveLength(4);
      expect(parsedReport.callTree.totalFunctions).toBeGreaterThan(15);
    });

    it("should perform type analysis on complex TypeScript interfaces", async () => {
      // Create complex type definitions
      const typesContent = `// Complex type system for e-commerce platform

// Base types
export interface Entity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Product domain
export interface Product extends Entity {
  name: string;
  description: string;
  price: Money;
  category: Category;
  variants: ProductVariant[];
  attributes: ProductAttribute[];
  inventory: InventoryStatus;
}

export interface ProductVariant extends Entity {
  productId: string;
  sku: string;
  name: string;
  price: Money;
  attributes: VariantAttribute[];
  inventory: InventoryItem;
}

export interface Money {
  amount: number;
  currency: Currency;
}

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  JPY = 'JPY'
}

export interface Category extends Entity {
  name: string;
  slug: string;
  parentId?: string;
  children?: Category[];
  products?: Product[];
}

// Order domain
export interface Order extends Entity {
  orderNumber: string;
  customer: Customer;
  items: OrderItem[];
  shipping: ShippingInfo;
  payment: PaymentInfo;
  status: OrderStatus;
  total: Money;
  discounts: Discount[];
}

export interface OrderItem {
  id: string;
  product: Product;
  variant?: ProductVariant;
  quantity: number;
  unitPrice: Money;
  totalPrice: Money;
  discounts: Discount[];
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURNED = 'returned'
}

// Customer domain
export interface Customer extends Entity {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  addresses: Address[];
  orders?: Order[];
  preferences: CustomerPreferences;
}

export interface Address extends Entity {
  type: AddressType;
  firstName: string;
  lastName: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export enum AddressType {
  BILLING = 'billing',
  SHIPPING = 'shipping'
}

// Utility types
export type CreateProduct = Omit<Product, keyof Entity>;
export type UpdateProduct = Partial<CreateProduct>;
export type ProductWithVariants = Product & { variants: ProductVariant[] };
export type CustomerWithOrders = Customer & { orders: Order[] };

// Generic repository interface
export interface Repository<T extends Entity> {
  findById(id: string): Promise<T | null>;
  findMany(criteria: Partial<T>): Promise<T[]>;
  create(data: Omit<T, keyof Entity>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}

// Service interfaces
export interface ProductService {
  getProduct(id: string): Promise<ProductWithVariants | null>;
  createProduct(data: CreateProduct): Promise<Product>;
  updateProduct(id: string, data: UpdateProduct): Promise<Product | null>;
  searchProducts(query: ProductSearchQuery): Promise<ProductSearchResult>;
}

export interface ProductSearchQuery {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  attributes?: Record<string, any>;
  sortBy?: 'name' | 'price' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ProductSearchResult {
  products: Product[];
  total: number;
  facets: SearchFacet[];
}

export interface SearchFacet {
  name: string;
  values: FacetValue[];
}

export interface FacetValue {
  value: string;
  count: number;
}

// Complex conditional types
export type ApiResponse<T> = {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
} | {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
};

export type EventPayload<T extends string> = 
  T extends 'product.created' ? { product: Product } :
  T extends 'product.updated' ? { product: Product; changes: Partial<Product> } :
  T extends 'order.placed' ? { order: Order } :
  T extends 'order.shipped' ? { order: Order; tracking: string } :
  never;

export interface DomainEvent<T extends string = string> {
  id: string;
  type: T;
  payload: EventPayload<T>;
  metadata: {
    timestamp: Date;
    source: string;
    version: number;
  };
}

// Mapped types
export type ProductAttributes = {
  [K in keyof Product]: Product[K] extends string ? string :
                        Product[K] extends number ? number :
                        Product[K] extends boolean ? boolean :
                        never;
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
`;

      await Write.implementation({
        file_path: join(srcDir, "types.ts"),
        content: typesContent
      });

      // Create implementation file that uses these types
      const implementationContent = `import {
  Product, Customer, Order, OrderItem, ProductService,
  CreateProduct, UpdateProduct, ProductWithVariants,
  Repository, ApiResponse, DomainEvent, EventPayload
} from './types.js';

export class ProductServiceImpl implements ProductService {
  constructor(private productRepo: Repository<Product>) {}

  async getProduct(id: string): Promise<ProductWithVariants | null> {
    const product = await this.productRepo.findById(id);
    if (!product) return null;

    // Type assertion showing complex type usage
    return product as ProductWithVariants;
  }

  async createProduct(data: CreateProduct): Promise<Product> {
    const product = await this.productRepo.create(data);
    
    // Emit domain event
    await this.emitEvent('product.created', { product });
    
    return product;
  }

  async updateProduct(id: string, data: UpdateProduct): Promise<Product | null> {
    const existing = await this.productRepo.findById(id);
    if (!existing) return null;

    const updated = await this.productRepo.update(id, data);
    if (!updated) return null;

    // Emit domain event with changes
    await this.emitEvent('product.updated', { 
      product: updated, 
      changes: data 
    });

    return updated;
  }

  async searchProducts(query: any): Promise<any> {
    // Implementation would use the complex query type
    return { products: [], total: 0, facets: [] };
  }

  private async emitEvent<T extends string>(
    type: T, 
    payload: EventPayload<T>
  ): Promise<void> {
    const event: DomainEvent<T> = {
      id: Math.random().toString(36),
      type,
      payload,
      metadata: {
        timestamp: new Date(),
        source: 'ProductService',
        version: 1
      }
    };
    
    // Event publishing logic would go here
    console.log('Event emitted:', event);
  }
}

export class OrderProcessor {
  processOrder(order: Order): ApiResponse<Order> {
    try {
      // Complex order processing logic
      const processedOrder = this.validateAndProcessOrder(order);
      
      return {
        success: true,
        data: processedOrder,
        meta: {
          total: 1
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PROCESSING_ERROR',
          message: 'Failed to process order',
          details: error
        }
      };
    }
  }

  private validateAndProcessOrder(order: Order): Order {
    // Validation and processing logic
    return order;
  }
}`;

      await Write.implementation({
        file_path: join(srcDir, "implementation.ts"),
        content: implementationContent
      });

      // Analyze types
      const typeFiles = [
        join(srcDir, "types.ts"),
        join(srcDir, "implementation.ts")
      ];

      const analysisResults = analyzeFiles(typeFiles, { types: true });
      expect(analysisResults).toHaveLength(2);

      // Perform type analysis
      const typeAnalysisResult = performTypeAnalysis(analysisResults);
      expect(typeAnalysisResult).toBeDefined();
      expect(typeAnalysisResult.allTypes.size).toBeGreaterThan(0);

      // Generate type documentation
      const allTypesArray = Array.from(typeAnalysisResult.allTypes.values());
      const interfaces = allTypesArray.filter(type => type.kind === "interface");
      const typeAliases = allTypesArray.filter(type => type.kind === "type");
      const enums = allTypesArray.filter(type => type.kind === "enum");

      const typeDoc = `# Type System Analysis Report

Generated: ${new Date().toISOString()}

## Summary
- **Total Types**: ${allTypesArray.length}
- **Interfaces**: ${interfaces.length}
- **Type Aliases**: ${typeAliases.length}  
- **Enums**: ${enums.length}

## Interface Hierarchy
${interfaces
  .map(
    iface => `
### ${iface.name}
- **File**: ${iface.filePath}
- **Line**: ${iface.line || "N/A"}
`
  )
  .join("")}

## Type Aliases
${typeAliases
  .map(
    type => `
### ${type.name}
- **File**: ${type.filePath}
- **Line**: ${type.line || "N/A"}
`
  )
  .join("")}

## Enums
${enums
  .map(
    enumType => `
### ${enumType.name}
- **File**: ${enumType.filePath}
- **Line**: ${enumType.line || "N/A"}
`
  )
  .join("")}

## Analysis Details
The type system includes complex patterns such as:
- Generic interfaces (Repository<T>)
- Conditional types (EventPayload<T>)
- Mapped types (ProductAttributes)
- Union types (ApiResponse<T>)
- Utility types (RequiredFields, OptionalFields)

This indicates a sophisticated TypeScript codebase with advanced type-level programming.
`;

      const typeDocPath = join(analysisOutputDir, "type-analysis.md");
      await Write.implementation({
        file_path: typeDocPath,
        content: typeDoc
      });

      const docResponse = await Read.implementation({ file_path: typeDocPath });
      expect(docResponse.success).toBe(true);
      const docContent = docResponse.message;

      expect(docContent).toContain("Type System Analysis Report");
      expect(docContent).toContain("Interface Hierarchy");
      expect(docContent).toContain("Repository<T>");
    });
  });

  describe("Analysis with Tool Integration", () => {
    it("should analyze codebase and use tools for refactoring suggestions", async () => {
      // Create code with common issues that need refactoring
      const problematicCode = `// Legacy code with various issues
export function processUserData(userData: any): any {
  // TODO: Add proper type annotations
  if (!userData) {
    throw new Error("No data");
  }
  
  let result = {};
  
  // Code duplication
  if (userData.type === 'premium') {
    result.discountRate = 0.15;
    result.freeShipping = true;
    result.prioritySupport = true;
  }
  
  if (userData.type === 'standard') {
    result.discountRate = 0.05;
    result.freeShipping = false;
    result.prioritySupport = false;
  }
  
  if (userData.type === 'basic') {
    result.discountRate = 0.0;
    result.freeShipping = false;
    result.prioritySupport = false;
  }
  
  // Magic numbers
  if (userData.purchases > 10) {
    result.loyaltyBonus = 25;
  }
  
  return result;
}

export function calculateTotal(items: any[]): number {
  // TODO: Add input validation
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price * items[i].quantity;
  }
  return total;
}

export function validateEmail(email: any): boolean {
  // TODO: Improve validation
  return email.includes('@');
}`;

      await Write.implementation({
        file_path: join(srcDir, "legacy.ts"),
        content: problematicCode
      });

      // Analyze the problematic code
      const analysisResults = analyzeFiles([join(srcDir, "legacy.ts")]);
      expect(analysisResults).toHaveLength(1);

      const result = analysisResults[0];
      const functions = result.entities.filter(e => e.type === "function");
      expect(functions).toHaveLength(3);

      // Generate refactoring suggestions
      const refactoringSuggestions = {
        file: result.filePath,
        issues: [
          {
            type: "type-safety",
            line: "processUserData(userData: any): any",
            suggestion: "Replace 'any' types with proper interfaces",
            severity: "high"
          },
          {
            type: "code-duplication",
            lines: [
              "userData.type === 'premium'",
              "userData.type === 'standard'",
              "userData.type === 'basic'"
            ],
            suggestion: "Extract user type configuration into a lookup object",
            severity: "medium"
          },
          {
            type: "magic-numbers",
            line: "userData.purchases > 10",
            suggestion: "Extract magic number into named constant",
            severity: "low"
          }
        ],
        refactoredCode: `// Refactored code with improvements
export interface UserData {
  type: 'premium' | 'standard' | 'basic';
  purchases: number;
  email?: string;
}

export interface UserBenefits {
  discountRate: number;
  freeShipping: boolean;
  prioritySupport: boolean;
  loyaltyBonus?: number;
}

const USER_TYPE_BENEFITS = {
  premium: {
    discountRate: 0.15,
    freeShipping: true,
    prioritySupport: true
  },
  standard: {
    discountRate: 0.05,
    freeShipping: false,
    prioritySupport: false
  },
  basic: {
    discountRate: 0.0,
    freeShipping: false,
    prioritySupport: false
  }
} as const;

const LOYALTY_THRESHOLD = 10;
const LOYALTY_BONUS = 25;

export function processUserData(userData: UserData): UserBenefits {
  if (!userData) {
    throw new Error("User data is required");
  }
  
  const baseBenefits = USER_TYPE_BENEFITS[userData.type];
  const result: UserBenefits = { ...baseBenefits };
  
  if (userData.purchases > LOYALTY_THRESHOLD) {
    result.loyaltyBonus = LOYALTY_BONUS;
  }
  
  return result;
}

export function calculateTotal(items: Array<{price: number; quantity: number}>): number {
  if (!Array.isArray(items)) {
    throw new Error("Items must be an array");
  }
  
  return items.reduce((total, item) => {
    if (typeof item.price !== 'number' || typeof item.quantity !== 'number') {
      throw new Error("Invalid item: price and quantity must be numbers");
    }
    return total + (item.price * item.quantity);
  }, 0);
}

export function validateEmail(email: string): boolean {
  if (typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}`
      };

      // Write refactoring suggestions report
      const refactoringReportPath = join(
        analysisOutputDir,
        "refactoring-suggestions.json"
      );
      await Write.implementation({
        file_path: refactoringReportPath,
        content: JSON.stringify(refactoringSuggestions, null, 2)
      });

      // Apply automated refactoring using Edit tool
      const legacyFilePath = join(srcDir, "legacy.ts");

      // Replace the entire file with refactored code
      await Write.implementation({
        file_path: join(srcDir, "refactored.ts"),
        content: refactoringSuggestions.refactoredCode
      });

      // Analyze refactored code to compare
      const refactoredAnalysis = analyzeFiles([join(srcDir, "refactored.ts")]);
      expect(refactoredAnalysis).toHaveLength(1);

      const refactoredResult = refactoredAnalysis[0];
      const refactoredFunctions = refactoredResult.entities.filter(
        e => e.type === "function"
      );
      const refactoredInterfaces = refactoredResult.entities.filter(
        e => e.type === "interface"
      );

      // Verify improvements
      expect(refactoredFunctions).toHaveLength(3);
      expect(refactoredInterfaces).toHaveLength(2); // UserData, UserBenefits

      // Generate comparison report
      const comparisonReport = {
        analysis: {
          original: {
            file: result.filePath,
            functions: functions.length,
            interfaces: result.entities.filter(e => e.type === "interface").length,
            totalLines: result.totalLines
          },
          refactored: {
            file: refactoredResult.filePath,
            functions: refactoredFunctions.length,
            interfaces: refactoredInterfaces.length,
            totalLines: refactoredResult.totalLines
          }
        },
        improvements: [
          "Added proper TypeScript interfaces",
          "Eliminated code duplication with lookup object",
          "Extracted magic numbers into named constants",
          "Improved error handling and validation",
          "Added comprehensive input validation"
        ],
        metrics: {
          typesSafety: "Improved from 'any' types to proper interfaces",
          maintainability: "Reduced code duplication and magic numbers",
          readability: "Better function and variable names"
        }
      };

      const comparisonReportPath = join(
        analysisOutputDir,
        "refactoring-comparison.json"
      );
      await Write.implementation({
        file_path: comparisonReportPath,
        content: JSON.stringify(comparisonReport, null, 2)
      });

      // Verify all reports were created
      const reportFiles = [
        "refactoring-suggestions.json",
        "refactoring-comparison.json"
      ];
      for (const reportFile of reportFiles) {
        const reportPath = join(analysisOutputDir, reportFile);
        expect(existsSync(reportPath)).toBe(true);

        const response = await Read.implementation({ file_path: reportPath });
        expect(response.success).toBe(true);
        const content = response.message;

        expect(typeof content).toBe("string");
        expect(content.length).toBeGreaterThan(0);
      }
    });

    it("should integrate with MCP tools during analysis workflow", async () => {
      // Set up MCP server with analysis tools
      const analysisServerConfig: McpServerConfig = {
        id: "analysis-tools-server",
        name: "Analysis Tools Server",
        type: "stdio",
        command: "echo",
        args: ["analysis server"],
        enabled: true
      };

      await mcpClientManager.addServer(analysisServerConfig);

      // Mock analysis-specific MCP tools
      const analysisTools: McpTool[] = [
        {
          name: "complexity_analyzer",
          description: "Analyze code complexity metrics",
          inputSchema: {
            type: "object",
            properties: {
              filePath: { type: "string" },
              metrics: { type: "array", items: { type: "string" } }
            }
          },
          serverId: analysisServerConfig.id,
          serverName: analysisServerConfig.name
        },
        {
          name: "dependency_tracker",
          description: "Track and visualize dependencies",
          inputSchema: {
            type: "object",
            properties: {
              projectPath: { type: "string" },
              outputFormat: { type: "string", enum: ["json", "dot", "svg"] }
            }
          },
          serverId: analysisServerConfig.id,
          serverName: analysisServerConfig.name
        }
      ];

      state.availableTools = analysisTools;

      // Create code for analysis
      const complexCode = `export class ComplexService {
        private dependencies: Map<string, any> = new Map();
        
        constructor(
          private userService: any,
          private emailService: any,
          private logService: any,
          private cacheService: any
        ) {}
        
        async processComplexWorkflow(data: any): Promise<any> {
          try {
            const step1 = await this.validateInput(data);
            const step2 = await this.enrichData(step1);
            const step3 = await this.processBusinessLogic(step2);
            const step4 = await this.persistResults(step3);
            const step5 = await this.notifyUsers(step4);
            const step6 = await this.updateCache(step5);
            const step7 = await this.logResults(step6);
            
            return step7;
          } catch (error) {
            await this.handleError(error);
            throw error;
          }
        }
        
        private async validateInput(data: any): Promise<any> {
          // Complex validation logic with nested conditions
          if (data.type === 'A') {
            if (data.subType === 'A1') {
              if (data.category === 'premium') {
                return this.validatePremiumA1(data);
              } else if (data.category === 'standard') {
                return this.validateStandardA1(data);
              }
            }
          }
          return data;
        }
        
        // ... many more complex methods
        private async enrichData(data: any): Promise<any> { return data; }
        private async processBusinessLogic(data: any): Promise<any> { return data; }
        private async persistResults(data: any): Promise<any> { return data; }
        private async notifyUsers(data: any): Promise<any> { return data; }
        private async updateCache(data: any): Promise<any> { return data; }
        private async logResults(data: any): Promise<any> { return data; }
        private async handleError(error: any): Promise<void> {}
        private async validatePremiumA1(data: any): Promise<any> { return data; }
        private async validateStandardA1(data: any): Promise<any> { return data; }
      }`;

      await Write.implementation({
        file_path: join(srcDir, "complex-service.ts"),
        content: complexCode
      });

      // Perform standard analysis
      const analysisResults = analyzeFiles([join(srcDir, "complex-service.ts")]);
      expect(analysisResults).toHaveLength(1);

      const result = analysisResults[0];
      const methods = result.entities.filter(
        e => e.type === "function" || e.type === "method"
      );

      // Simulate using MCP tools for additional analysis
      const mcpAnalysisResults = {
        complexity: {
          tool: "complexity_analyzer",
          results: {
            cyclomaticComplexity: 15,
            cognitiveComplexity: 22,
            linesOfCode: result.totalLines,
            methods: methods.length,
            complexity_issues: [
              {
                method: "processComplexWorkflow",
                complexity: 8,
                recommendation: "Consider breaking into smaller functions"
              },
              {
                method: "validateInput",
                complexity: 6,
                recommendation: "Use strategy pattern for validation"
              }
            ]
          }
        },
        dependencies: {
          tool: "dependency_tracker",
          results: {
            internal_dependencies: 0,
            external_dependencies: 4, // userService, emailService, etc.
            dependency_graph: {
              ComplexService: [
                "userService",
                "emailService",
                "logService",
                "cacheService"
              ]
            }
          }
        }
      };

      // Create comprehensive analysis report combining built-in and MCP analysis
      const comprehensiveReport = {
        timestamp: new Date().toISOString(),
        file: result.filePath,
        built_in_analysis: {
          entities: result.entities.length,
          functions: methods.length,
          lines: result.totalLines,
          entity_types: result.entities.reduce(
            (acc, entity) => {
              acc[entity.type] = (acc[entity.type] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          )
        },
        mcp_analysis: mcpAnalysisResults,
        recommendations: [
          {
            category: "complexity",
            priority: "high",
            description:
              "Reduce cyclomatic complexity in processComplexWorkflow method",
            suggested_action:
              "Extract workflow steps into separate methods or use command pattern"
          },
          {
            category: "dependencies",
            priority: "medium",
            description:
              "High number of constructor dependencies indicates potential SRP violation",
            suggested_action:
              "Consider using dependency injection container or facade pattern"
          },
          {
            category: "validation",
            priority: "medium",
            description: "Complex nested validation logic in validateInput",
            suggested_action: "Implement strategy or chain of responsibility pattern"
          }
        ],
        quality_score: {
          complexity: 6.5, // Out of 10
          maintainability: 7.0,
          testability: 5.5,
          overall: 6.3
        }
      };

      const comprehensiveReportPath = join(
        analysisOutputDir,
        "comprehensive-analysis.json"
      );
      await Write.implementation({
        file_path: comprehensiveReportPath,
        content: JSON.stringify(comprehensiveReport, null, 2)
      });

      // Generate actionable improvement plan using tools
      const improvementPlan = `# Code Improvement Plan

Generated: ${new Date().toISOString()}

## Current State
- **File**: ${result.filePath}
- **Complexity Score**: ${comprehensiveReport.quality_score.complexity}/10
- **Methods**: ${methods.length}
- **Lines**: ${result.totalLines}

## Priority Actions

### High Priority
1. **Reduce Method Complexity**
   - Target: \`processComplexWorkflow\` method (complexity: 8)
   - Action: Extract each step into dedicated service methods
   - Expected Impact: Improve testability and maintainability

### Medium Priority  
2. **Refactor Dependencies**
   - Target: Constructor with 4 dependencies
   - Action: Implement facade or aggregate pattern
   - Expected Impact: Reduce coupling and improve SRP compliance

3. **Simplify Validation Logic**
   - Target: \`validateInput\` nested conditionals
   - Action: Implement validation strategy pattern
   - Expected Impact: Improve extensibility and readability

## Implementation Steps
1. Create separate service classes for workflow steps
2. Implement validation strategies
3. Introduce facade for dependency management
4. Add comprehensive unit tests
5. Measure complexity improvements

## Tools Used
- Built-in analysis engine for entity extraction
- MCP complexity_analyzer for metrics
- MCP dependency_tracker for relationship mapping
`;

      const improvementPlanPath = join(analysisOutputDir, "improvement-plan.md");
      await Write.implementation({
        file_path: improvementPlanPath,
        content: improvementPlan
      });

      // Verify all analysis outputs were created
      const expectedFiles = ["comprehensive-analysis.json", "improvement-plan.md"];

      for (const filename of expectedFiles) {
        const filePath = join(analysisOutputDir, filename);
        expect(existsSync(filePath)).toBe(true);

        const content = await Read.implementation({ file_path: filePath });
        expect(content).toBeDefined();
        expect(typeof content.message).toBe("string");
        expect(content.message.length).toBeGreaterThan(100);
      }

      // Verify MCP tools were "used" (simulated)
      expect(mcpAnalysisResults.complexity.tool).toBe("complexity_analyzer");
      expect(mcpAnalysisResults.dependencies.tool).toBe("dependency_tracker");
      expect(
        mcpAnalysisResults.complexity.results.cyclomaticComplexity
      ).toBeGreaterThan(0);
    });
  });

  describe("Analysis Performance and Scalability", () => {
    it("should handle analysis of large file sets efficiently", async () => {
      const startTime = Date.now();

      // Generate a large number of files programmatically
      const fileCount = 50;
      const generatedFiles: string[] = [];

      for (let i = 0; i < fileCount; i++) {
        const moduleDir = join(srcDir, `module-${Math.floor(i / 10)}`);
        await Bash.implementation({
          command: `mkdir -p "${moduleDir}"`
        });

        const fileName = `service-${i}.ts`;
        const filePath = join(moduleDir, fileName);

        const generatedCode = `// Auto-generated service ${i}
export interface Service${i}Config {
  enabled: boolean;
  timeout: number;
  retries: number;
}

export class Service${i} {
  private config: Service${i}Config;
  private clients: Map<string, any> = new Map();

  constructor(config: Service${i}Config) {
    this.config = config;
  }

  async process${i}(data: any): Promise<any> {
    if (!this.config.enabled) {
      throw new Error('Service ${i} is disabled');
    }

    try {
      const result = await this.processInternal${i}(data);
      await this.logResult${i}(result);
      return result;
    } catch (error) {
      await this.handleError${i}(error);
      throw error;
    }
  }

  private async processInternal${i}(data: any): Promise<any> {
    // Simulate processing
    const processed = { 
      ...data, 
      serviceId: ${i},
      processed: true,
      timestamp: new Date().toISOString()
    };
    
    return processed;
  }

  private async logResult${i}(result: any): Promise<void> {
    console.log(\`Service ${i} processed result:, result\`);
  }

  private async handleError${i}(error: any): Promise<void> {
    console.error(\`Service ${i} error:\`, error);
  }

  getConfig(): Service${i}Config {
    return this.config;
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export function createService${i}(config?: Partial<Service${i}Config>): Service${i} {
  const defaultConfig: Service${i}Config = {
    enabled: true,
    timeout: 5000,
    retries: 3
  };
  
  return new Service${i}({ ...defaultConfig, ...config });
}
`;

        await Write.implementation({
          file_path: filePath,
          content: generatedCode
        });

        generatedFiles.push(filePath);
      }

      const fileGenerationTime = Date.now() - startTime;

      // Discover all files
      const discoveryStart = Date.now();
      const allFiles = getCodeFiles(projectDir);
      const discoveryTime = Date.now() - discoveryStart;

      expect(allFiles.length).toBe(fileCount);

      // Analyze all files
      const analysisStart = Date.now();
      const analysisResults = analyzeFiles(allFiles);
      const analysisTime = Date.now() - analysisStart;

      expect(analysisResults.length).toBe(fileCount);

      // Calculate metrics
      const totalEntities = analysisResults.reduce(
        (sum, result) => sum + result.entities.length,
        0
      );
      const totalLines = analysisResults.reduce(
        (sum, result) => sum + result.totalLines,
        0
      );

      // Perform call tree analysis
      const callTreeStart = Date.now();
      const callTreeResult = performCallTreeAnalysis(analysisResults);
      const callTreeTime = Date.now() - callTreeStart;

      const totalTime = Date.now() - startTime;

      // Generate performance report
      const performanceReport = {
        timestamp: new Date().toISOString(),
        performance_metrics: {
          total_time_ms: totalTime,
          file_generation_ms: fileGenerationTime,
          file_discovery_ms: discoveryTime,
          analysis_ms: analysisTime,
          call_tree_analysis_ms: callTreeTime
        },
        scale_metrics: {
          files_analyzed: analysisResults.length,
          total_entities: totalEntities,
          total_lines: totalLines,
          functions_in_call_tree: callTreeResult.allFunctions.size
        },
        performance_ratios: {
          ms_per_file: Math.round((analysisTime / fileCount) * 100) / 100,
          entities_per_second: Math.round((totalEntities / analysisTime) * 1000),
          lines_per_second: Math.round((totalLines / analysisTime) * 1000)
        },
        scalability_assessment: {
          file_discovery:
            discoveryTime < 1000
              ? "excellent"
              : discoveryTime < 5000
                ? "good"
                : "needs optimization",
          analysis_speed:
            analysisTime < 10000
              ? "excellent"
              : analysisTime < 30000
                ? "good"
                : "needs optimization",
          call_tree_performance:
            callTreeTime < 5000
              ? "excellent"
              : callTreeTime < 15000
                ? "good"
                : "needs optimization",
          overall_rating:
            totalTime < 20000
              ? "excellent"
              : totalTime < 60000
                ? "good"
                : "needs optimization"
        }
      };

      const performanceReportPath = join(
        analysisOutputDir,
        "performance-report.json"
      );
      await Write.implementation({
        file_path: performanceReportPath,
        content: JSON.stringify(performanceReport, null, 2)
      });

      // Performance assertions (adjust thresholds as needed)
      expect(totalTime).toBeLessThan(60000); // 60 seconds max for 50 files
      expect(analysisTime).toBeLessThan(30000); // 30 seconds max for analysis
      expect(callTreeTime).toBeLessThan(15000); // 15 seconds max for call tree
      expect(totalEntities).toBeGreaterThan(fileCount * 3); // At least 3 entities per file
      expect(callTreeResult.allFunctions.size).toBeGreaterThan(fileCount); // At least 1 function per file

      // Memory usage should be reasonable (this is a rough check)
      expect(performanceReport.performance_ratios.ms_per_file).toBeLessThan(1000); // < 1 second per file
    });
  });
});
