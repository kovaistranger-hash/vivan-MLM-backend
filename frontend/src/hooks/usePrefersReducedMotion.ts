import { useReducedMotion } from 'framer-motion';

/**
 * Mirrors the user’s system “reduce motion” preference.
 * Prefer this over ad-hoc matchMedia when Framer Motion is available.
 */
export function usePrefersReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}
