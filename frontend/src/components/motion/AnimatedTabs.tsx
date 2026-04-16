import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { reducedTabContentVariants, tabContentVariants } from './motionTokens';

export type TabDef<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  tabs: TabDef<T>[];
  value: T;
  onChange: (id: T) => void;
  tabListClassName?: string;
  tabButtonClass: (active: boolean) => string;
  children: (id: T) => ReactNode;
  panelClassName?: string;
};

export default function AnimatedTabs<T extends string>({
  tabs,
  value,
  onChange,
  tabListClassName,
  tabButtonClass,
  children,
  panelClassName
}: Props<T>) {
  const reduce = usePrefersReducedMotion();
  const panelVariants = reduce ? reducedTabContentVariants : tabContentVariants;

  return (
    <div>
      <div className={tabListClassName}>
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => onChange(t.id)} className={tabButtonClass(value === t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className={panelClassName}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={value}
            variants={panelVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ willChange: 'opacity, transform' }}
          >
            {children(value)}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
