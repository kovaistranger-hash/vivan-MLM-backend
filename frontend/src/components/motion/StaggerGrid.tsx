import { Children, type ReactElement, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { reducedStaggerItem, staggerContainer, staggerItem } from './motionTokens';

type Props = {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delayChildren?: number;
};

function childKey(child: ReactNode, index: number): string | number {
  if (typeof child === 'object' && child !== null && 'key' in child && child.key != null) {
    return String(child.key);
  }
  return index;
}

/**
 * Scroll-triggered stagger for grids. Outer `className` should include the grid/flex layout.
 */
export default function StaggerGrid({ children, className, stagger = 0.05, delayChildren = 0.04 }: Props) {
  const reduce = usePrefersReducedMotion();
  const items = Children.toArray(children).filter(Boolean) as ReactElement[];
  const itemVariants = reduce ? reducedStaggerItem : staggerItem;

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.08, margin: '0px 0px -8% 0px' }}
      variants={staggerContainer(reduce ? 0 : stagger, reduce ? 0 : delayChildren)}
    >
      {items.map((child, i) => (
        <motion.div key={childKey(child, i)} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
