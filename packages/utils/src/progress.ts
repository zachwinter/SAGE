export class ProgressBar {
  private total: number;
  private current: number;
  private width: number;
  private label: string;

  constructor(total: number, label: string = "", width: number = 20) {
    this.total = total;
    this.current = 0;
    this.width = width;
    this.label = label;
  }

  update(current: number): void {
    this.current = Math.min(current, this.total);
    this.render();
  }

  increment(amount: number = 1): void {
    this.current = Math.min(this.current + amount, this.total);
    this.render();
  }

  private render(): void {
    const percentage =
      this.total > 0 ? Math.round((this.current / this.total) * 100) : 0;
    const filledWidth = Math.round((this.current / this.total) * this.width) || 0;
    const emptyWidth = this.width - filledWidth;

    const filled = "█".repeat(filledWidth);
    const empty = "░".repeat(emptyWidth);

    process.stdout.write(`\r${this.label} [${filled}${empty}] ${percentage}%`);

    if (this.current >= this.total) {
      process.stdout.write("\n");
    }
  }

  finish(): void {
    this.current = this.total;
    this.render();
  }
}
