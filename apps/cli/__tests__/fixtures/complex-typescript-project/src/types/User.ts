export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  metadata?: UserMetadata;
}

export interface UserMetadata {
  lastLoginAt?: Date;
  preferences: UserPreferences;
  profile: UserProfile;
}

export interface UserPreferences {
  theme: "light" | "dark" | "auto";
  language: string;
  notifications: NotificationSettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
}

export interface UserProfile {
  bio?: string;
  website?: string;
  location?: string;
  birthDate?: Date;
}

export type UserRole = "admin" | "user" | "moderator";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: User): Promise<User>;
  update(id: string, user: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
  list(options: ListOptions): Promise<User[]>;
}

export interface ListOptions {
  offset: number;
  limit: number;
  sortBy: keyof User;
  sortOrder: "asc" | "desc";
}

export enum UserStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
  PENDING = "pending"
}
