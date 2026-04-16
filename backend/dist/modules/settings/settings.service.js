import { query } from '../../db/mysql.js';
const cache = { map: null, at: 0 };
const TTL_MS = 30_000;
export async function getSetting(key, fallback) {
    const map = await getSettingsMap();
    return map[key] ?? fallback;
}
export async function getSettingsMap() {
    const now = Date.now();
    if (cache.map && now - cache.at < TTL_MS)
        return cache.map;
    const rows = await query('SELECT `key`, `value` FROM settings');
    const map = {};
    for (const r of rows)
        map[r.key] = r.value;
    cache.map = map;
    cache.at = now;
    return map;
}
export function parseBool(v, fallback = false) {
    return v === 'true' || v === '1';
}
export function parseNumber(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}
