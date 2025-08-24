import { readFileSync } from "fs";
import { join } from "path";

export interface User {
  id: number;
  name: string;
  email?: string;
}

export type UserStatus = "active" | "inactive" | "pending";

export class UserService {
  private users: User[] = [];

  constructor(private dbPath: string) {
    this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    try {
      const data = readFileSync(join(this.dbPath, "users.json"), "utf8");
      this.users = JSON.parse(data);
    } catch (error) {
      console.error("Failed to load users:", error);
      this.users = [];
    }
  }

  findUser(id: number): User | undefined {
    return this.users.find(user => user.id === id);
  }

  async createUser(userData: Omit<User, "id">): Promise<User> {
    const newUser = {
      id: this.generateId(),
      ...userData
    };

    this.users.push(newUser);
    await this.saveUsers();
    return newUser;
  }

  private generateId(): number {
    return Math.max(...this.users.map(u => u.id), 0) + 1;
  }

  private async saveUsers(): Promise<void> {
    const data = JSON.stringify(this.users, null, 2);
    // writeFileSync would be called here in real implementation
    console.log("Saving users data...");
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export default UserService;
