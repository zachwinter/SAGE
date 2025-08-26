import chalk from "chalk";

interface PrettyTaskOptions {
  title: string;
  subtitle?: string;
  location?: string;
}

export class PrettyTask {
  private startTime: number;
  private line = chalk.magenta("│");
  private start: string;
  private complete = (m = "") => `${chalk.magenta("└─")}${m ? " " + chalk.magenta(m) : ""}`;
  protected isSubtask: boolean;

  constructor(options: PrettyTaskOptions & { isSubtask?: boolean } = {}) {
    const { title, subtitle, location, isSubtask = false } = options;
    this.startTime = Date.now();
    this.isSubtask = isSubtask;
    
    if (isSubtask) {
      // For subtasks, don't print the start line - parent will handle it
      this.start = "";
    } else {
      this.start = chalk.magenta("┌─ ") + chalk.magenta(title);
      
      if (subtitle) {
        this.start += " " + chalk.white(chalk.bold(subtitle));
      }
      
      if (location) {
        this.start += " " + chalk.magenta("in") + " " + chalk.white(location);
      }
      
      console.log(this.start);
    }
  }

  log(message: string, data?: string | number) {
    if (data !== undefined) {
      console.log(this.line, message, data);
    } else {
      console.log(this.line, message);
    }
  }

  logDim(message: string) {
    console.log(this.line, chalk.dim(message));
  }

  logKeyValue(key: string, value: string | number, keyPrefix = "", keySuffix = "") {
    const formattedKey = chalk.dim(chalk.gray(keyPrefix)) + key + chalk.dim(chalk.gray(keySuffix));
    console.log(this.line, formattedKey, value);
  }

  finish(message?: string) {
    const duration = Math.round(Date.now() - this.startTime);
    const timeStr = chalk.magenta(chalk.white(chalk.bold(duration) + " ms"));
    
    if (message) {
      const finalMessage = message.replace(/\{time\}/g, timeStr);
      console.log(this.complete(finalMessage));
    } else {
      console.log(this.complete(`Completed in ${timeStr}`));
    }
  }

  static formatCount(count: number, label: string): string {
    return chalk.magenta(
      chalk.white(chalk.bold(count.toLocaleString())) + chalk.white(` ${label}`)
    );
  }
}

interface TaskDefinition {
  title: string;
  subtitle?: string;
  location?: string;
  fn: (task: PrettyTask, taskList: PrettyTaskList) => Promise<any>;
}

export class PrettyTaskList {
  private startTime: number;
  private line = chalk.magenta("│");
  private complete = (m = "") => `${chalk.magenta("└─")}${m ? " " + chalk.magenta(m) : ""}`;
  private tasks: TaskDefinition[];
  public results: any[] = [];

  constructor(
    private title: string,
    private subtitle?: string,
    private location?: string
  ) {
    this.tasks = [];
    this.startTime = Date.now();
  }

  addTask(task: TaskDefinition) {
    this.tasks.push(task);
    return this;
  }

  async execute(): Promise<any[]> {
    const start = chalk.magenta("┌─ ") + chalk.magenta(this.title);
    let output = start;
    
    if (this.subtitle) {
      output += " " + chalk.white(chalk.bold(this.subtitle));
    }
    
    if (this.location) {
      output += " " + chalk.magenta("in") + " " + chalk.white(this.location);
    }
    
    console.log(output);

    for (let i = 0; i < this.tasks.length; i++) {
      const task = this.tasks[i];
      const taskNum = chalk.dim(`[${i + 1}/${this.tasks.length}]`);
      
      console.log(this.line, taskNum, chalk.magenta(task.title), 
        task.subtitle ? chalk.white(chalk.bold(task.subtitle)) : "");
      
      const prettyTask = new PrettyTask({ ...task, isSubtask: true });
      const taskStart = Date.now();
      
      try {
        const result = await task.fn(prettyTask, this);
        this.results.push(result);
        
        const taskDuration = Math.round(Date.now() - taskStart);
        const timeStr = chalk.magenta(chalk.white(chalk.bold(taskDuration) + " ms"));
        console.log(this.line, taskNum, chalk.dim(`completed in ${timeStr}`));
      } catch (error) {
        console.log(this.line, taskNum, chalk.red(`failed: ${error}`));
        throw error;
      }
    }

    const duration = Math.round(Date.now() - this.startTime);
    const timeStr = chalk.magenta(chalk.white(chalk.bold(duration) + " ms"));
    console.log(this.complete(`All ${this.tasks.length} tasks completed in ${timeStr}`));

    return this.results;
  }
}