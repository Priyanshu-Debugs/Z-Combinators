"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const PILLS = [
  { label: "See our methodology", href: "/methodology", primary: false },
  { label: "Read the architecture", href: "/about", primary: false },
];

const pillContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.15,
    },
  },
};

const pillItemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: "easeOut" as const },
  },
};

export default function ActionPills() {
  return (
    <motion.div
      variants={pillContainerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5"
    >
      {/* Large prominent Validate Idea Button */}
      <motion.div
        variants={pillItemVariants}
        whileHover={{ scale: 1.03, y: -2 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 450, damping: 15 }}
      >
        <Link
          href="/evaluate"
          className="group inline-flex items-center justify-center bg-black text-white border border-black rounded-full text-base sm:text-lg md:text-xl px-8 py-3.5 sm:px-10 sm:py-4 hover:bg-white hover:text-black hover:border-black transition-all duration-300 cursor-pointer shadow-lg hover:shadow-xl font-bold active:scale-95 w-full sm:w-auto text-center"
        >
          Validate your Idea
          <svg
            className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      </motion.div>

      {/* Secondary pills */}
      <motion.div
        variants={pillContainerVariants}
        className="flex flex-wrap gap-2.5 sm:gap-3"
      >
        {PILLS.map((pill) => (
          <motion.div
            key={pill.label}
            variants={pillItemVariants}
            whileHover={{ scale: 1.04, y: -1.5 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 450, damping: 15 }}
          >
            <Link
              href={pill.href}
              className="inline-flex items-center justify-center bg-white/70 text-black border border-black/10 rounded-full text-sm sm:text-base px-5 py-2.5 sm:px-6 sm:py-3 hover:bg-black hover:text-white transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md"
            >
              {pill.label}
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
