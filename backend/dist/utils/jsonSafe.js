/**
 * Recursively normalize driver-specific values so `res.json()` never throws
 * (e.g. mysql2 BIGINT as bigint — `JSON.stringify` throws on bigint).
 */
export function jsonSafeValue(value) {
    if (typeof value === 'bigint') {
        const n = Number(value);
        return Number.isSafeInteger(n) ? n : value.toString();
    }
    if (value == null)
        return value;
    if (value instanceof Date)
        return value.toISOString();
    if (Array.isArray(value))
        return value.map((x) => jsonSafeValue(x));
    if (typeof value === 'object') {
        const o = value;
        const out = {};
        for (const k of Object.keys(o)) {
            out[k] = jsonSafeValue(o[k]);
        }
        return out;
    }
    return value;
}
