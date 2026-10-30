// Shared Framer Motion variants — the design system's motion language.
// Keep durations short (150-300ms) and easing consistent (easeOut) for a snappy feel.

export const easeOut = [0.22, 1, 0.36, 1];
export const easeInOut = [0.4, 0, 0.2, 1];

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25, ease: easeOut } },
};

export const slideUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } },
};

export const slideDown = {
  hidden: { opacity: 0, y: -12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: easeOut } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: easeOut } },
};

export const stagger = (delay = 0.06) => ({
  hidden: {},
  visible: { transition: { staggerChildren: delay, delayChildren: 0.05 } },
});

export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: easeOut } },
};

export const hoverLift = {
  rest: { y: 0, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.06)' },
  hover: { y: -4, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.08)', transition: { duration: 0.2, ease: easeOut } },
};

export const tabContent = {
  hidden: { opacity: 0, x: 12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: easeOut } },
  exit: { opacity: 0, x: -12, transition: { duration: 0.2, ease: easeInOut } },
};

export const accordionContent = {
  hidden: { opacity: 0, height: 0 },
  visible: { opacity: 1, height: 'auto', transition: { duration: 0.3, ease: easeOut } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.2, ease: easeInOut } },
};