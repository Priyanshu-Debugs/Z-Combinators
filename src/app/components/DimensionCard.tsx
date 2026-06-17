"use client";

import { useTypewriter } from "../hooks/useTypewriter";
import { motion } from "framer-motion";

interface DimensionCardProps {
  dimension: string;
  score: number;
  justification: string;
  sourceExcerpt: string;
  sourceFramework: string;
  startDelay?: number;
}

export default function DimensionCard({
  dimension,
  score,
  justification,
  sourceExcerpt,
  sourceFramework,
  startDelay = 0,
}: DimensionCardProps) {
  // Use custom typewriter hook for the justification text
  const { displayed, done } = useTypewriter({
    text: justification,
    speed: 12, // Faster typing speed for longer reports
    startDelay: startDelay,
  });

  // Left border and badge colors based on score
  const getColorClasses = (s: number) => {
    if (s >= 8) {
      return {
        border: "border-l-4 border-l-score-high",
        badge: "score-bg-high score-high",
      };
    }
    if (s >= 5) {
      return {
        border: "border-l-4 border-l-score-mid",
        badge: "score-bg-mid score-mid",
      };
    }
    return {
      border: "border-l-4 border-l-score-low",
      badge: "score-bg-low score-low",
    };
  };

  const colors = getColorClasses(score);

  return (
    <div
      className={`rounded-2xl border bg-surface shadow-card transition-shadow duration-300 hover:shadow-card-hover p-6 md:p-8 space-y-4 ${colors.border}`}
      style={{ borderColor: "var(--color-border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="font-heading text-xl font-semibold text-text-primary">
          {dimension}
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wider ${colors.badge}`}
        >
          {score}/10
        </span>
      </div>

      {/* Analysis text with typewriter effect */}
      <div className="space-y-4">
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-2">
            Analysis
          </h4>
          <p className="text-base text-text-primary leading-relaxed font-body min-h-[40px]">
            {displayed}
            {!done && displayed.length > 0 && (
              <span className="typewriter-cursor" />
            )}
          </p>
        </div>

        {/* Cited Framework Context - fades in smoothly only after typewriter completes */}
        {sourceExcerpt && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: done ? 1 : 0, y: done ? 0 : 10 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={`space-y-2 pt-2 border-t border-border ${
              done ? "block" : "invisible"
            }`}
          >
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              Retrieved Framework Context
            </h4>
            <div
              className="border-l-2 pl-4 py-1 text-sm text-text-secondary italic leading-relaxed"
              style={{ borderColor: "var(--color-border-strong)" }}
            >
              <p className="mb-2">"{sourceExcerpt}"</p>
              <span className="text-[12px] not-italic font-medium text-text-primary">
                Source: {sourceFramework}
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
