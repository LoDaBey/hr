import type { Transition, Variants } from 'framer-motion';
import { density } from '@/theme';

const { motion: m } = density;

export const motionTransition: Transition = {
  duration: m.duration,
  ease: m.ease,
};

export const motionTransitionFast: Transition = {
  duration: m.durationFast,
  ease: m.ease,
};

export const motionTransitionSlow: Transition = {
  duration: m.durationSlow,
  ease: m.ease,
};

export const pageVariants: Variants = {
  initial: { opacity: 0, y: m.pageOffset },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -m.pageOffset / 2 },
};

export const fadeUpVariants: Variants = {
  initial: { opacity: 0, y: m.pageOffset },
  animate: { opacity: 1, y: 0 },
};

export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const shellVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

export const sidebarOverlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const listContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: m.stagger, delayChildren: m.durationFast },
  },
};

export const listItemVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

export const loginCardVariants: Variants = {
  initial: { opacity: 0, y: m.pageOffset, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -m.pageOffset, scale: 0.98 },
};
