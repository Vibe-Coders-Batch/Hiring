'use client';

import { AnimatePresence, motion, type MotionProps } from 'framer-motion';
import type { PropsWithChildren } from 'react';

const easeOutExpo = [0.16, 1, 0.3, 1] as const;
const easeOutQuint = [0.22, 1, 0.36, 1] as const;

export const fadeSlideVariants: MotionProps['variants'] = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: easeOutExpo } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16, ease: 'easeIn' } },
};

export const cardHoverVariants: MotionProps['variants'] = {
  rest: { y: 0, boxShadow: 'var(--shadow-sm)' },
  hover: { y: -2, boxShadow: 'var(--shadow-md)', transition: { duration: 0.15 } },
};

export const modalVariants: MotionProps['variants'] = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.22, ease: easeOutExpo } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.16, ease: 'easeIn' } },
};

export const toastVariants: MotionProps['variants'] = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: easeOutQuint } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18 } },
};

export function FadeSlide({ children, ...rest }: PropsWithChildren<MotionProps>) {
  return (
    <motion.div variants={fadeSlideVariants} initial="initial" animate="animate" exit="exit" {...rest}>
      {children}
    </motion.div>
  );
}

export { AnimatePresence, motion };
