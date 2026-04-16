import { motion, type HTMLMotionProps } from 'framer-motion';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { fadeUpReveal, reducedFadeReveal } from './motionTokens';

type Props = HTMLMotionProps<'div'> & {
  /** Viewport margin for earlier trigger, e.g. "-10% 0px" */
  margin?: string;
  /** Fire only the first time the section enters view */
  once?: boolean;
};

export default function FadeInSection({
  children,
  className,
  margin = '0px 0px -10% 0px',
  once = true,
  ...rest
}: Props) {
  const reduce = usePrefersReducedMotion();
  const variants = reduce ? reducedFadeReveal : fadeUpReveal;

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount: 0.15, margin }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
