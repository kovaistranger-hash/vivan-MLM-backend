import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { ProductCardModel } from '../components/ProductCard';

const KEY = 'vivan_wishlist_v1';

/** Event name for wishlist storage updates (subscribe + notify). */
export const WISHLIST_CHANGED_EVENT = 'vivan-wishlist';

/** Call after mutating wishlist in localStorage outside `write` / `toggle` if needed. */
export function notifyWishlistChanged() {
  window.dispatchEvent(new Event(WISHLIST_CHANGED_EVENT));
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(WISHLIST_CHANGED_EVENT, onStoreChange);
  return () => window.removeEventListener(WISHLIST_CHANGED_EVENT, onStoreChange);
}

/** Stable snapshot: raw string from localStorage (not a parsed array). */
function getSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

function getServerSnapshot(): string {
  return '';
}

function parseItems(raw: string): ProductCardModel[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: ProductCardModel[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  notifyWishlistChanged();
}

export function useWishlist() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const items = useMemo(() => parseItems(raw), [raw]);
  const count = items.length;

  const toggle = useCallback((p: ProductCardModel) => {
    const cur = parseItems(localStorage.getItem(KEY) ?? '');
    const exists = cur.some((x) => x.id === p.id);
    if (exists) write(cur.filter((x) => x.id !== p.id));
    else write([{ ...p }, ...cur]);
    return !exists;
  }, []);

  return { items, count, toggle };
}
