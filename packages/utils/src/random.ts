import type { Random } from './types.js';

export class SystemRandom implements Random {
  int(): number {
    return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  }

  float(): number {
    return Math.random();
  }
}

export class SeededRandom implements Random {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  private next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
    return this.seed;
  }

  int(): number {
    return this.next();
  }

  float(): number {
    return this.next() / Math.pow(2, 32);
  }
}