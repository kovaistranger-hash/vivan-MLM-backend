import { motion, type HTMLMotionProps } from 'framer-motion';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { durations, easings } from './motionTokens';

type Props = HTMLMotionProps<'div'>;

/** Subtle hover lift + shadow for cards (transform/opacity only). */
export default function MotionCard({ children, className, ...rest }: Props) {
  const reduce = usePrefersReducedMotion();

  return (
    <motion.div
      className={className}
      whileHover={
        reduce
          ? undefined
          : {
              y: -4,
              boxShadow: '0 20px 40px -14px rgb(15 23 42 / 0.18)'
            }
      }
      transition={{ duration: durations.fast, ease: easings.smooth }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
