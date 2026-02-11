# Call Signatures

```typescript
// Agent task description
interface AgentTask {
  description: string;
  prompt: string;
}

// Bash
interface Bash {
  command: string;
  timeout?: number;
  description?: string;
}

// Glob
interface Glob {
  pattern: string;
  path?: string;
}

// Grep
interface Grep {
  pattern: string;
  path?: string;
  include?: string;
}

// LS
interface LS {
  path: string;
  ignore?: string[];
}

// exit_plan_mode
interface ExitPlanMode {
  plan: string;
}

// Read
interface Read {
  file_path: string;
  offset?: number;
  limit?: number;
}

// Edit
interface Edit {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

// MultiEdit
interface MultiEdit {
  file_path: string;
  edits: Array<{
    old_string: string;
    new_string: string;
    replace_all?: boolean;
  }>;
}

// Write
interface Write {
  file_path: string;
  content: string;
}

// NotebookRead
interface NotebookRead {
  notebook_path: string;
}

// NotebookEdit
interface NotebookEdit {
  notebook_path: string;
  cell_number: number;
  new_source: string;
  cell_type?: "code" | "markdown";
  edit_mode?: "replace" | "insert" | "delete";
}

// WebFetch
interface WebFetch {
  url: string;
  prompt: string;
}

// TodoRead
interface TodoRead {}

// TodoWrite
interface TodoWrite {
  todos: Array<{
    content: string;
    status: "pending" | "in_progress" | "completed";
    priority: "high" | "medium" | "low";
    id: string;
  }>;
}

// WebSearch
interface WebSearch {
  query: string;
  allowed_domains?: string[];
  blocked_domains?: string[];
}
```
