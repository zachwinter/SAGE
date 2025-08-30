import { promises as fs } from "fs";
import { FileSystemOperations } from "./interfaces.js";

export const realFileSystemOperations: FileSystemOperations = {
  readFile: async path => {
    return fs.readFile(path, "utf8");
  },

  writeFile: async (path, content) => {
    // Ensure directory exists
    const dir = path.substring(0, path.lastIndexOf("/"));
    if (dir) {
      await fs.mkdir(dir, { recursive: true });
    }
    return fs.writeFile(path, content, "utf8");
  },

  exists: async path => {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  },

  mkdir: async (path, options) => {
    await fs.mkdir(path, options);
    return undefined;
  },

  rm: async (path, options) => {
    return fs.rm(path, options);
  }
};
