export class SystemClock {
    now() {
        return new Date().toISOString();
    }
}
export class FixedClock {
    timestamp;
    constructor(timestamp) {
        this.timestamp = timestamp;
    }
    now() {
        return this.timestamp;
    }
}
//# sourceMappingURL=clock.js.map