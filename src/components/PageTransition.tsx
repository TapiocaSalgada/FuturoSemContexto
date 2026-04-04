"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return <>{children}</>;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 20, scale: 0.992, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -14, scale: 1.005, filter: "blur(6px)" }}
        transition={{
          y: { type: "spring", stiffness: 180, damping: 24, mass: 0.55 },
          scale: { type: "spring", stiffness: 200, damping: 24, mass: 0.55 },
          opacity: { duration: 0.24, ease: "easeOut" },
          filter: { duration: 0.24, ease: "easeOut" },
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
