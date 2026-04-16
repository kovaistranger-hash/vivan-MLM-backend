import type { Transition, Variants } from 'framer-motion';

/** Seconds — tight, premium pacing */
export const durations = {
  fast: 0.18,
  base: 0.28,
  slow: 0.4
} as const;

/** Normalized cubic-bezier tuples for `ease` / `transition.ease` */
export const easings = {
  smooth: [0.22, 1, 0.36, 1] as const,
  soft: [0.16, 1, 0.3, 1] as const
};

const smoothEase = easings.smooth;
const softEase = easings.soft;

export const transitions = {
  page: { duration: durations.base, ease: smoothEase } satisfies Transition,
  pageExit: { duration: durations.fast, ease: smoothEase } satisfies Transition,
  fadeUp: { duration: durations.base, ease: softEase } satisfies Transition,
  micro: { duration: durations.fast, ease: smoothEase } satisfies Transition,
  toast: { duration: durations.base, ease: smoothEase } satisfies Transition,
  tab: { duration: durations.fast, ease: softEase } satisfies Transition
};

/** Route-level enter/exit (storefront + admin shell) */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: transitions.page
  },
  exit: {
    opacity: 0,
    y: 6,
    transition: transitions.pageExit
  }
};

/** Admin: minimal vertical motion */
export const adminPageVariants: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.base, ease: smoothEase }
  },
  exit: {
    opacity: 0,
    y: 2,
    transition: { duration: durations.fast, ease: smoothEase }
  }
};

export const reducedPageVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.12, ease: 'linear' }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1, ease: 'linear' }
  }
};

export const fadeUpReveal: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: transitions.fadeUp
  }
};

export const reducedFadeReveal: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.14, ease: 'linear' } }
};

export function staggerContainer(stagger = 0.05, delayChildren = 0.04): Variants {
  return {
    hidden: {},
    show: {
      transition: { staggerChildren: stagger, delayChildren }
    }
  };
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.base, ease: softEase }
  }
};

export const reducedStaggerItem: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.12, ease: 'linear' } }
};

export const hoverLift = {
  rest: { y: 0, boxShadow: '0 10px 15px -3px rgb(15 23 42 / 0.08)' },
  hover: {
    y: -4,
    boxShadow: '0 20px 40px -12px rgb(30 27 75 / 0.22)',
    transition: transitions.micro
  }
};

export const imageZoomHover = {
  rest: { scale: 1 },
  hover: { scale: 1.06, transition: { duration: 0.45, ease: smoothEase } }
};

export const buttonTap = { scale: 0.98 };
export const buttonTapReduced = { scale: 1 };

export const toastMotion = {
  initial: { opacity: 0, y: -8, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: transitions.toast
  },
  exit: { opacity: 0, y: -4, transition: { duration: durations.fast, ease: smoothEase } }
};

export const tabContentVariants: Variants = {
  initial: { opacity: 0, x: 8 },
  animate: { opacity: 1, x: 0, transition: transitions.tab },
  exit: { opacity: 0, x: -6, transition: { duration: 0.14, ease: smoothEase } }
};

export const reducedTabContentVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.1 } }
};

export const imageSwapVariants: Variants = {
  initial: { opacity: 0, scale: 1.02 },
  animate: { opacity: 1, scale: 1, transition: { duration: durations.fast, ease: smoothEase } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: 'linear' } }
};
