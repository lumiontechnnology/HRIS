'use client';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, delayChildren: 0.1, staggerChildren: 0.1 } }
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};
const numberVariants = {
  hidden: (direction: number) => ({ opacity: 0, x: direction * 40, y: 15, rotate: direction * 5 }),
  visible: { opacity: 0.7, x: 0, y: 0, rotate: 0, transition: { duration: 0.8 } }
};
const ghostVariants = {
  hidden: { scale: 0.8, opacity: 0, y: 15, rotate: -5 },
  visible: { scale: 1, opacity: 1, y: 0, rotate: 0, transition: { duration: 0.6 } },
  hover: { scale: 1.1, y: -10, rotate: [0, -5, 5, -5, 0], transition: { duration: 0.8 } },
  floating: { y: [-5, 5], transition: { y: { duration: 2, repeat: Infinity, repeatType: "reverse" as const } } }
};

export function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <AnimatePresence mode="wait">
        <motion.div className="text-center" variants={containerVariants} initial="hidden" animate="visible" exit="hidden">
          <div className="flex items-center justify-center gap-4 md:gap-6 mb-8 md:mb-12">
            <motion.span className="text-[80px] md:text-[120px] font-display font-normal text-foreground opacity-60 select-none" variants={numberVariants} custom={-1}>4</motion.span>
            <motion.div variants={ghostVariants} whileHover="hover" animate={["visible", "floating"]}>
              <svg viewBox="0 0 120 120" className="w-[80px] h-[80px] md:w-[120px] md:h-[120px]" fill="none">
                <ellipse cx="60" cy="55" rx="38" ry="42" fill="hsl(var(--muted))" opacity="0.6"/>
                <rect x="22" y="55" width="76" height="42" fill="hsl(var(--muted))" opacity="0.6"/>
                <path d="M22 97 Q32 110 42 97 Q52 84 62 97 Q72 110 82 97 Q92 84 98 97 L98 97 L22 97Z" fill="hsl(var(--background))"/>
                <ellipse cx="46" cy="52" rx="6" ry="8" fill="hsl(var(--background))"/>
                <ellipse cx="74" cy="52" rx="6" ry="8" fill="hsl(var(--background))"/>
              </svg>
            </motion.div>
            <motion.span className="text-[80px] md:text-[120px] font-display font-normal text-foreground opacity-60 select-none" variants={numberVariants} custom={1}>4</motion.span>
          </div>
          <motion.h1 className="font-display text-3xl md:text-4xl font-normal text-foreground mb-4 md:mb-6 opacity-70 select-none" variants={itemVariants}>Page not found.</motion.h1>
          <motion.p className="text-sm text-muted-foreground mb-8 md:mb-12 max-w-xs mx-auto select-none" variants={itemVariants}>The page you're looking for doesn't exist or you don't have access to it.</motion.p>
          <motion.div variants={itemVariants} whileHover={{ scale: 1.05, transition: { duration: 0.3 } }}>
            <Link href="/dashboard" className="inline-block bg-foreground text-background px-6 py-2.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity select-none">Back to dashboard</Link>
          </motion.div>
          <motion.div className="mt-8" variants={itemVariants}>
            <p className="text-xs text-muted-foreground/40 select-none">Error 404 · Page not found</p>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
