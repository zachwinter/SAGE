import { User, UserRepository } from "../types/User.js";
import { Logger } from "../utils/Logger.js";
import { ValidationError, NotFoundError } from "../errors/index.js";

export interface UserServiceConfig {
  maxRetries: number;
  timeoutMs: number;
}

export class UserService {
  private logger: Logger;
  private repository: UserRepository;
  private config: UserServiceConfig;

  constructor(
    repository: UserRepository,
    config: UserServiceConfig = { maxRetries: 3, timeoutMs: 5000 }
  ) {
    this.repository = repository;
    this.config = config;
    this.logger = new Logger("UserService");
  }

  async createUser(userData: Partial<User>): Promise<User> {
    this.logger.info("Creating user", { userData });

    if (!userData.email || !userData.name) {
      throw new ValidationError("Email and name are required");
    }

    const existingUser = await this.repository.findByEmail(userData.email);
    if (existingUser) {
      throw new ValidationError("User with this email already exists");
    }

    return this.repository.create({
      id: generateId(),
      email: userData.email,
      name: userData.name,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    });
  }

  async getUserById(id: string): Promise<User> {
    this.logger.debug("Fetching user by ID", { id });

    const user = await this.repository.findById(id);
    if (!user) {
      throw new NotFoundError(`User with ID ${id} not found`);
    }

    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const existingUser = await this.getUserById(id);

    const updatedUser = {
      ...existingUser,
      ...updates,
      updatedAt: new Date()
    };

    return this.repository.update(id, updatedUser);
  }

  async deleteUser(id: string): Promise<void> {
    await this.getUserById(id); // Ensure user exists
    await this.repository.delete(id);
    this.logger.info("User deleted", { id });
  }

  async listUsers(options: ListUsersOptions = {}): Promise<User[]> {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = options;

    return this.repository.list({
      offset: (page - 1) * limit,
      limit,
      sortBy,
      sortOrder
    });
  }
}

export interface ListUsersOptions {
  page?: number;
  limit?: number;
  sortBy?: keyof User;
  sortOrder?: "asc" | "desc";
}

function generateId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
