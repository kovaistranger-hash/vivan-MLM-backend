import { AnimatePresence, motion } from 'framer-motion';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { imageSwapVariants } from './motionTokens';

type Props = {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
};

/** Cross-fade / soft scale when `src` changes (e.g. product gallery). */
export default function MotionImageSwap({ src, alt, className, imgClassName }: Props) {
  const reduce = usePrefersReducedMotion();
  const variants = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.12 } },
        exit: { opacity: 0, transition: { duration: 0.08 } }
      }
    : imageSwapVariants;

  return (
    <div className={className}>
      <AnimatePresence mode="sync" initial={false}>
        <motion.img
          key={src}
          src={src}
          alt={alt}
          className={imgClassName}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          draggable={false}
          style={{ willChange: 'opacity, transform' }}
        />
      </AnimatePresence>
    </div>
  );
}
