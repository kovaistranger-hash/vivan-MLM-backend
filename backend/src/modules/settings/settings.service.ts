import { query } from '../../db/mysql.js';

const cache: { map: Record<string, string> | null; at: number } = { map: null, at: 0 };
const TTL_MS = 30_000;

export async function getSetting(key: string, fallback: string) {
  const map = await getSettingsMap();
  return map[key] ?? fallback;
}

export async function getSettingsMap() {
  const now = Date.now();
  if (cache.map && now - cache.at < TTL_MS) return cache.map;

  const rows = await query<{ key: string; value: string }[]>('SELECT `key`, `value` FROM settings');
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  cache.map = map;
  cache.at = now;
  return map;
}

export function parseBool(v: string, fallback = false) {
  return v === 'true' || v === '1';
}

export function parseNumber(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
