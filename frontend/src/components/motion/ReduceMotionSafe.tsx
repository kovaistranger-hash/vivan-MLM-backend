import { MotionConfig } from 'framer-motion';

/** Respects `prefers-reduced-motion` for all descendant motion components. */
export function ReduceMotionSafe({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
