import type { Random } from './types.js';
export declare class SystemRandom implements Random {
    int(): number;
    float(): number;
}
export declare class SeededRandom implements Random {
    private seed;
    constructor(seed: number);
    private next;
    int(): number;
    float(): number;
}
//# sourceMappingURL=random.d.ts.map