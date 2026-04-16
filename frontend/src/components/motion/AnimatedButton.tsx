import { motion, type HTMLMotionProps } from 'framer-motion';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { buttonTap, buttonTapReduced, durations, easings } from './motionTokens';

type Props = HTMLMotionProps<'button'>;

export default function AnimatedButton({ children, className, type = 'button', ...rest }: Props) {
  const reduce = usePrefersReducedMotion();
  return (
    <motion.button
      type={type}
      className={className}
      whileTap={reduce ? buttonTapReduced : buttonTap}
      transition={{ duration: durations.fast, ease: easings.smooth }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
