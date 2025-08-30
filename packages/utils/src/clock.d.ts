import type { Clock, ISO8601 } from './types.js';
export declare class SystemClock implements Clock {
    now(): ISO8601;
}
export declare class FixedClock implements Clock {
    private readonly timestamp;
    constructor(timestamp: ISO8601);
    now(): ISO8601;
}
//# sourceMappingURL=clock.d.ts.map