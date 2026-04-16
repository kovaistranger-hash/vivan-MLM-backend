import { AnimatePresence, motion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { adminPageVariants, pageVariants, reducedPageVariants } from './motionTokens';

type Tone = 'storefront' | 'admin';

export default function PageTransition({ tone = 'storefront' }: { tone?: Tone }) {
  const location = useLocation();
  const reduce = usePrefersReducedMotion();
  const variants = reduce ? reducedPageVariants : tone === 'admin' ? adminPageVariants : pageVariants;

  return (
    <AnimatePresence mode="sync" initial={false}>
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        className="motion-page-root"
        style={{ willChange: 'opacity, transform' }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
