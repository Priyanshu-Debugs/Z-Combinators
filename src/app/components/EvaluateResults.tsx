"use client";

import React, { useEffect, useState } from "react";
import { motion, useSpring, useMotionValue } from "framer-motion";
import RadarChart from "./RadarChart";
import DimensionCard from "./DimensionCard";

interface Dimension {
  dimension: string;
  score: number;
  justification: string;
  source_excerpt: string;
  source_framework: string;
  confidence: "high" | "medium" | "low";
}

interface EvaluateResultsProps {
  dimensions: Dimension[];
}

const ALL_DIMENSIONS = [
  "Market",
  "Team",
  "Timing",
  "Competition",
  "Moat",
  "Execution",
];

const getScoreColorClass = (s: number) => {
  if (s >= 8) return "score-high";
  if (s >= 5) return "score-mid";
  return "score-low";
};

const DIMENSION_HELPERS: Record<string, { prompt: string; icon: React.ReactNode }> = {
  market: {
    prompt: "Describe your customer base, TAM, and target market size.",
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253" />
      </svg>
    ),
  },
  team: {
    prompt: "Discuss who is on the founding team and their relevant domain expertise.",
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  timing: {
    prompt: "Explain why this startup is viable now. Any macro trends or tech shifts?",
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  competition: {
    prompt: "Detail your main competitors and how you differentiate from them.",
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  moat: {
    prompt: "Outline your unfair advantage, defensibility, or network effects.",
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  execution: {
    prompt: "Detail your go-to-market plan, pricing, and distribution model.",
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
};

/* ===== Animated Score Counter Hook ===== */
function AnimatedScore({ value }: { value: number }) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { stiffness: 60, damping: 20 });
  const [display, setDisplay] = useState("0.0");

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = springValue.on("change", (v) => {
      setDisplay((Math.round(v * 10) / 10).toFixed(1));
    });
    return unsubscribe;
  }, [springValue]);

  return <>{display}</>;
}

/* ===== Score Ring SVG ===== */
function ScoreRing({ score, size = 100 }: { score: number | null; size?: number }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score !== null ? (score / 10) * circumference : 0;
  const offset = circumference - progress;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth="5"
      />
      {/* Progress ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#scoreGradient)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="score-ring-circle"
      />
      <defs>
        <linearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0A0A0A" />
          <stop offset="100%" stopColor="#3a3a3a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function EvaluateResults({ dimensions }: EvaluateResultsProps) {
  // Map dimensions list by name for quick lookup
  const scoredMap = new Map<string, Dimension>();
  dimensions.forEach((d) => {
    scoredMap.set(d.dimension.toLowerCase(), d);
  });

  // Calculate overall score (average of only the scored dimensions)
  const scoredDimensions = ALL_DIMENSIONS.map((name) =>
    scoredMap.get(name.toLowerCase())
  ).filter(Boolean) as Dimension[];

  const overallScore =
    scoredDimensions.length > 0
      ? roundScore(
          scoredDimensions.reduce((acc, curr) => acc + curr.score, 0) /
            scoredDimensions.length
        )
      : null;

  function roundScore(val: number): number {
    return Math.round(val * 10) / 10;
  }

  // Radar scores data (0 for unscored dimensions)
  const radarScores = ALL_DIMENSIONS.map((name) => {
    const d = scoredMap.get(name.toLowerCase());
    return {
      dimension: name,
      score: d ? d.score : 0,
    };
  });

  // Find strongest and weakest dimensions
  const strongest = scoredDimensions.length > 0
    ? scoredDimensions.reduce((a, b) => (a.score >= b.score ? a : b))
    : null;
  const weakest = scoredDimensions.length > 0
    ? scoredDimensions.reduce((a, b) => (a.score <= b.score ? a : b))
    : null;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: "easeOut" as const },
    },
  };

  return (
    <div className="w-full space-y-8">
      {/* Radar Chart Visual */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full p-6 rounded-2xl border bg-surface/40 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] border-border flex flex-col items-center justify-center min-h-[350px] relative overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
      >
        {/* Overall Score with ring */}
        <div className="absolute top-5 left-6 text-left flex items-start space-x-3">
          <div className="relative">
            <ScoreRing score={overallScore} size={72} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className={`font-heading text-lg font-bold tracking-tight ${
                  overallScore ? getScoreColorClass(overallScore) : "text-text-secondary"
                }`}
                style={{ transform: "rotate(90deg)" }}
              >
                {overallScore !== null ? <AnimatedScore value={overallScore} /> : "--"}
              </span>
            </div>
          </div>
          <div className="pt-1">
            <span className="text-[10px] font-bold tracking-wider uppercase text-text-secondary block">
              Overall Score
            </span>
            <span className="text-[10px] text-text-secondary block mt-0.5 font-semibold">
              {scoredDimensions.length} of 6 dimensions scored
            </span>
          </div>
        </div>

        <div className="w-full pt-4">
          <RadarChart scores={radarScores} />
        </div>

        {/* Strength / Weakness Summary */}
        {strongest && weakest && scoredDimensions.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="w-full flex flex-wrap items-center justify-center gap-3 pt-2 pb-1 text-[11px] font-semibold"
          >
            <span className="flex items-center space-x-1 text-score-high">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
              <span>Strongest: {strongest.dimension} ({strongest.score})</span>
            </span>
            <span className="text-text-tertiary">|</span>
            <span className="flex items-center space-x-1 text-score-low">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              <span>Weakest: {weakest.dimension} ({weakest.score})</span>
            </span>
          </motion.div>
        )}
      </motion.div>

      {/* Grid of Dimension Details */}
      <div className="space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="border-b border-border pb-3"
        >
          <h2 className="font-heading text-xl font-bold text-text-primary tracking-tight">
            Dossier Evaluation Report
          </h2>
          <p className="text-text-secondary text-xs mt-1 leading-relaxed">
            The evaluations update dynamically as you share information about your idea in the chat.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-4.5"
        >
          {ALL_DIMENSIONS.map((name, index) => {
            const d = scoredMap.get(name.toLowerCase());
            const helper = DIMENSION_HELPERS[name.toLowerCase()];

            if (d) {
              // Dimension is Scored
              return (
                <motion.div key={name} variants={itemVariants}>
                  <DimensionCard
                    dimension={name}
                    score={d.score}
                    justification={d.justification}
                    sourceExcerpt={d.source_excerpt}
                    sourceFramework={d.source_framework}
                    startDelay={index * 100}
                  />
                </motion.div>
              );
            }

            // Dimension is Unscored (Pending Info)
            return (
              <motion.div key={name} variants={itemVariants}>
                <div
                  className="rounded-2xl border border-border/80 bg-surface/20 hover:bg-surface/30 p-5 md:p-6 flex items-start space-x-4 transition-all duration-300 shadow-[0_1px_3px_rgba(0,0,0,0.01)] hover:border-border pending-breathe"
                >
                  {/* Left Icon */}
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-text-secondary/5 border border-text-secondary/10 flex items-center justify-center text-text-secondary/60">
                    {helper?.icon}
                  </div>

                  {/* Content Area */}
                  <div className="flex-1 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-heading text-base font-bold text-text-primary">
                        {name}
                      </h3>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-wider uppercase bg-text-secondary/5 text-text-secondary/70 border border-text-secondary/10"
                      >
                        Pending Info
                      </span>
                    </div>

                    <p className="text-xs text-text-secondary leading-relaxed font-body font-medium">
                      No evaluation yet. Share details about your startup&apos;s {name.toLowerCase()} in the chat.
                    </p>

                    {helper?.prompt && (
                      <div className="pt-2">
                        <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block mb-1">
                          Try answering this in chat:
                        </span>
                        <div className="inline-block bg-accent/5 border border-accent/10 rounded-lg px-2.5 py-1.5 text-[11px] text-text-primary font-medium font-body leading-normal select-all cursor-text">
                          {helper.prompt}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
