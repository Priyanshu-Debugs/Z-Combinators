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
  onPromptClick?: (prompt: string) => void;
}

const ALL_DIMENSIONS = [
  "Market",
  "Team",
  "Timing",
  "Competition",
  "Moat",
  "Execution",
];

/* ===== Animated Score Counter Hook ===== */
function AnimatedScore({ value }: { value: number }) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { stiffness: 70, damping: 18 });
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

/* ===== Score Ring SVG with Crisp Light Stroke ===== */
function ScoreRing({ score, size = 80 }: { score: number | null; size?: number }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score !== null ? (score / 10) * circumference : 0;
  const offset = circumference - progress;

  const getRingColor = (s: number | null) => {
    if (s === null) return "#D4D4D8";
    if (s >= 8) return "#059669";
    if (s >= 5) return "#D97706";
    return "#E11D48";
  };

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#E4E4E7"
        strokeWidth="6"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={getRingColor(score)}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1s ease-out, stroke 0.5s ease" }}
      />
    </svg>
  );
}

export default function EvaluateResults({ dimensions, onPromptClick }: EvaluateResultsProps) {
  const scoredMap = new Map<string, Dimension>();
  dimensions.forEach((d) => {
    scoredMap.set(d.dimension.toLowerCase(), d);
  });

  const scoredDimensions = ALL_DIMENSIONS.map((name) =>
    scoredMap.get(name.toLowerCase())
  ).filter((d) => d && d.score > 0) as Dimension[];

  const overallScore =
    scoredDimensions.length > 0
      ? Math.round(
          (scoredDimensions.reduce((acc, curr) => acc + curr.score, 0) /
            scoredDimensions.length) *
            10
        ) / 10
      : null;

  const radarScores = ALL_DIMENSIONS.map((name) => {
    const d = scoredMap.get(name.toLowerCase());
    return {
      dimension: name,
      score: d ? d.score : 0,
    };
  });

  const strongest = scoredDimensions.length > 0
    ? scoredDimensions.reduce((a, b) => (a.score >= b.score ? a : b))
    : null;
  const weakest = scoredDimensions.length > 0
    ? scoredDimensions.reduce((a, b) => (a.score <= b.score ? a : b))
    : null;

  const getTierBadge = (s: number | null) => {
    if (s === null) {
      return {
        label: "Evaluation Pending",
        desc: "Share your pitch in chat to unlock framework scoring",
        className: "bg-neutral-100 text-neutral-700 border-neutral-200",
      };
    }
    if (s >= 8.0) {
      return {
        label: "Strong Fundability Signal",
        desc: "Top quartile seed potential. Ready for accelerator demo day.",
        className: "bg-emerald-50 text-emerald-800 border-emerald-200",
      };
    }
    if (s >= 5.0) {
      return {
        label: "Promising with Addressable Gaps",
        desc: "Viable thesis. Strengthen defensibility, go-to-market, or unit economics.",
        className: "bg-amber-50 text-amber-800 border-amber-200",
      };
    }
    return {
      label: "Early Validation Phase",
      desc: "High risk profile. Refine customer validation and problem-solution fit.",
      className: "bg-rose-50 text-rose-800 border-rose-200",
    };
  };

  const tier = getTierBadge(overallScore);

  return (
    <div className="w-full space-y-6">
      {/* Top Hero Dossier Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full p-5 sm:p-6 rounded-2xl border border-black/8 bg-white shadow-sm flex flex-col space-y-5"
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-black/6 pb-4">
          {/* Score & Dial */}
          <div className="flex items-center space-x-4">
            <div className="relative shrink-0 flex items-center justify-center">
              <ScoreRing score={overallScore} size={84} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-heading text-xl font-bold text-[#0A0A0A] tracking-tight">
                  {overallScore !== null ? <AnimatedScore value={overallScore} /> : "--"}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h2 className="font-heading text-base font-bold text-[#0A0A0A] tracking-tight">
                  Investor Evaluation Dossier
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${tier.className}`}>
                  {tier.label}
                </span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed font-body font-medium">
                {tier.desc}
              </p>
              <span className="text-[11px] text-neutral-500 block font-semibold pt-0.5">
                {scoredDimensions.length} of 6 institutional dimensions evaluated
              </span>
            </div>
          </div>
        </div>

        {/* Radar Chart Centerpiece */}
        <div className="w-full pt-1 pb-2 flex items-center justify-center">
          <RadarChart
            scores={radarScores}
            onSelectDimension={(dim) => {
              const el = document.getElementById(`dimension-${dim.toLowerCase()}`);
              el?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        </div>

        {/* Strongest vs Vulnerability Highlights */}
        {strongest && weakest && scoredDimensions.length >= 2 && (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs font-semibold select-none border-t border-black/6">
            <span className="flex items-center space-x-1.5 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              <span>▲</span>
              <span>Strongest Pillar: {strongest.dimension} ({strongest.score}/10)</span>
            </span>
            <span className="flex items-center space-x-1.5 text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
              <span>▼</span>
              <span>Needs Attention: {weakest.dimension} ({weakest.score}/10)</span>
            </span>
          </div>
        )}
      </motion.div>

      {/* Grid of Dimension Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-neutral-500">
            Institutional Dimension Breakdowns
          </h3>
          <span className="text-[11px] text-neutral-400 font-medium">
            YC & a16z Benchmarks
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {ALL_DIMENSIONS.map((name, idx) => {
            const d = scoredMap.get(name.toLowerCase());
            return (
              <div key={name} id={`dimension-${name.toLowerCase()}`}>
                <DimensionCard
                  dimension={name}
                  score={d ? d.score : 0}
                  justification={d ? d.justification : ""}
                  sourceExcerpt={d ? d.source_excerpt : ""}
                  sourceFramework={d ? d.source_framework : ""}
                  confidence={d ? d.confidence : "low"}
                  onPromptClick={onPromptClick}
                  startDelay={idx * 0.05}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
