import { motion, type HTMLMotionProps } from 'framer-motion';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { durations, easings } from './motionTokens';

type Props = HTMLMotionProps<'div'>;

/** Subtle entrance for sticky/fixed UI blocks (mobile buy bars, etc.). */
export default function StickyReveal({ children, className, ...rest }: Props) {
  const reduce = usePrefersReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { y: 10, opacity: 0.97 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: durations.base, ease: easings.smooth }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
