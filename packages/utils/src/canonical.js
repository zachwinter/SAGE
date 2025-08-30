export function canonicalJSONStringify(value) {
    return JSON.stringify(canonicalize(value));
}
function canonicalize(value) {
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(canonicalize);
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value;
        const sortedKeys = Object.keys(obj).sort();
        const result = {};
        for (const key of sortedKeys) {
            result[key] = canonicalize(obj[key]);
        }
        return result;
    }
    // For functions, symbols, and other non-JSON serializable values
    return undefined;
}
//# sourceMappingURL=canonical.js.map