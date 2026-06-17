"use client";

import { motion } from "framer-motion";

export default function LoadingSkeleton() {
  const cards = Array.from({ length: 6 });

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="w-full space-y-8">
      <div className="text-center space-y-2">
        <h2 className="font-heading text-2xl font-semibold text-text-primary">
          Analyzing your idea...
        </h2>
        <p className="text-text-secondary text-sm">
          Applying YC, a16z, and NFX evaluation frameworks to your pitch.
        </p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
      >
        {cards.map((_, i) => (
          <motion.div
            key={i}
            variants={itemVariants}
            className="skeleton h-32 rounded-2xl border border-border"
          />
        ))}
      </motion.div>
    </div>
  );
}
