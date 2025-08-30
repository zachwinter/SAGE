import type { Clock, ISO8601 } from './types.js';

export class SystemClock implements Clock {
  now(): ISO8601 {
    return new Date().toISOString() as ISO8601;
  }
}

export class FixedClock implements Clock {
  constructor(private readonly timestamp: ISO8601) {}

  now(): ISO8601 {
    return this.timestamp;
  }
}