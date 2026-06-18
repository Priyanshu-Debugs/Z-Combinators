"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useRef } from "react";
import PageTransition from "../components/PageTransition";
import Disclaimer from "../components/Disclaimer";

const DIMENSIONS = [
  {
    num: "01",
    name: "Market",
    description:
      "Is the addressable market large enough, growing, and reachable? We evaluate total market size, growth trajectory, and whether a technology or regulatory shift creates a new opening.",
  },
  {
    num: "02",
    name: "Team",
    description:
      "Does the founding team have the domain expertise, complementary skills, and founder-market fit to execute on this specific idea?",
  },
  {
    num: "03",
    name: "Timing",
    description:
      "Is the world ready for this product right now? We assess whether macro trends, technology maturity, and user behavior shifts make this the right moment.",
  },
  {
    num: "04",
    name: "Competition",
    description:
      "How crowded is the space, and can this idea differentiate structurally -- not just incrementally -- from existing players?",
  },
  {
    num: "05",
    name: "Moat",
    description:
      "Can this business build durable competitive advantages over time? We evaluate network effects, switching costs, data advantages, and brand defensibility.",
  },
  {
    num: "06",
    name: "Execution",
    description:
      "How clear and achievable is the path from idea to working product? We assess MVP scope, build complexity, and whether the first version can ship quickly.",
  },
];

const SOURCES = [
  {
    name: "YC (Y Combinator)",
    description:
      "Startup School lectures, application guides, and partner essays on what makes startups succeed.",
  },
  {
    name: "a16z (Andreessen Horowitz)",
    description:
      "Published frameworks on market analysis, founder evaluation, and go-to-market strategy.",
  },
  {
    name: "NFX",
    description:
      "Systematic frameworks on network effects, timing, defensibility, and growth mechanics.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

const sourceVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" as const },
  },
};

export default function MethodologyPage() {
  return (
    <PageTransition>
      <div className="flex-grow pt-28 md:pt-32 pb-16 px-5 sm:px-8 md:px-10 lg:px-16 max-w-4xl mx-auto w-full space-y-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="space-y-4"
        >
          <h1 className="font-heading text-3xl md:text-4xl font-semibold text-text-primary tracking-tight">
            How Z-Combinator evaluates your idea
          </h1>
          <p className="text-text-secondary text-base md:text-lg max-w-2xl leading-relaxed">
            Every score is grounded in frameworks from the world&apos;s top startup accelerators and investors. Here is exactly what we look at.
          </p>
        </motion.div>

        {/* 6 Dimensions Grid */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4 }}
            className="border-b border-border pb-2"
          >
            <h2 className="font-heading text-xl font-semibold text-text-primary">
              The Six Dimensions
            </h2>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
          >
            {DIMENSIONS.map((dim) => (
              <motion.div
                key={dim.num}
                variants={cardVariants}
                whileHover={{
                  y: -3,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
                  borderColor: "rgba(0, 0, 0, 0.12)",
                }}
                className="rounded-2xl border bg-surface p-6 md:p-8 shadow-card transition-all duration-300 cursor-default group"
                style={{ borderColor: "var(--color-border)" }}
              >
                <span className="font-heading text-[13px] text-text-tertiary group-hover:text-text-primary font-semibold tracking-widest block uppercase transition-colors duration-300">
                  {dim.num}
                </span>
                <h3 className="font-heading text-xl font-semibold text-text-primary mt-2">
                  {dim.name}
                </h3>
                <p className="text-text-secondary text-sm md:text-base leading-relaxed mt-3">
                  {dim.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Framework Sources */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4 }}
            className="border-b border-border pb-2"
          >
            <h2 className="font-heading text-xl font-semibold text-text-primary">
              Built on established frameworks
            </h2>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6"
          >
            {SOURCES.map((source) => (
              <motion.div
                key={source.name}
                variants={sourceVariants}
                whileHover={{ y: -2, boxShadow: "0 6px 20px rgba(0,0,0,0.05)" }}
                className="rounded-2xl border bg-surface p-6 shadow-card transition-all duration-200"
                style={{ borderColor: "var(--color-border)" }}
              >
                <h3 className="font-heading text-lg font-semibold text-text-primary">
                  {source.name}
                </h3>
                <p className="text-text-secondary text-xs sm:text-sm leading-relaxed mt-2">
                  {source.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* CTA section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="rounded-2xl border bg-surface p-8 md:p-12 text-center space-y-6 shadow-card"
          style={{ borderColor: "var(--color-border)" }}
        >
          <h2 className="font-heading text-2xl font-semibold text-text-primary max-w-md mx-auto leading-tight">
            Ready to see how your idea scores?
          </h2>
          <Link
            href="/evaluate"
            className="group inline-flex items-center px-8 py-3.5 rounded-full bg-accent text-accent-inverse text-base font-medium transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
          >
            Validate your Idea
            <svg
              className="ml-2 w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </motion.div>
      </div>
      <Disclaimer />
    </PageTransition>
  );
}
