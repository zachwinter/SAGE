export type ISO8601 = string & {
    __brand: 'ISO8601';
};
export interface Clock {
    now(): ISO8601;
}
export interface Random {
    int(): number;
    float(): number;
}
export interface TypedError extends Error {
    code: string;
    cause?: unknown;
}
//# sourceMappingURL=types.d.ts.map