import { motion } from 'framer-motion';
import PageTransition from './motion/PageTransition';
import StorefrontHeader from './storefront/StorefrontHeader';
import StorefrontFooter from './storefront/StorefrontFooter';
import MobileBottomNav from './storefront/MobileBottomNav';
import StorefrontCategoryStrip from './storefront/StorefrontCategoryStrip';
import FloatingEarnCta from './storefront/FloatingEarnCta';
import { useStickyHeader } from '../hooks/useStickyHeader';
import { durations, easings } from './motion/motionTokens';

export default function Layout() {
  const headerScrolled = useStickyHeader(6);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-slate-50">
      <motion.header
        className="sticky top-0 z-50 border-b border-transparent bg-white/85 backdrop-blur-md backdrop-saturate-150"
        animate={{
          boxShadow: headerScrolled
            ? '0 12px 28px -8px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(226, 232, 240, 0.65)'
            : '0 6px 18px -10px rgba(15, 23, 42, 0.1), 0 0 0 1px rgba(226, 232, 240, 0.35)',
          backgroundColor: headerScrolled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.78)'
        }}
        transition={{ duration: durations.base, ease: easings.smooth }}
        style={{ willChange: 'box-shadow, background-color' }}
      >
        <StorefrontHeader />
        <StorefrontCategoryStrip />
      </motion.header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 pb-28 sm:py-10 md:pb-10">
        <PageTransition />
      </main>

      <StorefrontFooter />
      <MobileBottomNav />
      <FloatingEarnCta />
    </div>
  );
}
