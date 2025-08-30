export class SystemRandom {
    int() {
        return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    }
    float() {
        return Math.random();
    }
}
export class SeededRandom {
    seed;
    constructor(seed) {
        this.seed = seed;
    }
    next() {
        this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
        return this.seed;
    }
    int() {
        return this.next();
    }
    float() {
        return this.next() / Math.pow(2, 32);
    }
}
//# sourceMappingURL=random.js.map