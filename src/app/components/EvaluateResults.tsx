"use client";

import { motion } from "framer-motion";
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
  overallScore: number;
  dimensions: Dimension[];
  onReset: () => void;
}

export default function EvaluateResults({
  overallScore,
  dimensions,
  onReset,
}: EvaluateResultsProps) {
  // Color styling for overall score
  const getScoreColorClass = (s: number) => {
    if (s >= 8) return "score-high";
    if (s >= 5) return "score-mid";
    return "score-low";
  };

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
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  };

  // Convert dimensions to format needed by RadarChart
  const radarScores = dimensions.map((d) => ({
    dimension: d.dimension,
    score: d.score,
  }));

  return (
    <div className="w-full space-y-12">
      {/* Overall Score Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex flex-col items-center justify-center">
          <span
            className={`font-heading text-6xl md:text-7xl font-bold tracking-tight ${getScoreColorClass(
              overallScore
            )}`}
          >
            {overallScore}
          </span>
          <span className="text-text-secondary text-sm font-semibold tracking-wider uppercase mt-1">
            Overall Score
          </span>
        </div>
      </div>

      {/* Radar Chart Visual */}
      <div className="py-4">
        <RadarChart scores={radarScores} />
      </div>

      {/* Grid of Dimension Details */}
      <div className="space-y-4">
        <div className="border-b border-border pb-2">
          <h2 className="font-heading text-xl font-semibold text-text-primary">
            Dossier Evaluation Report
          </h2>
          <p className="text-text-secondary text-xs mt-1">
            The complete, framework-grounded analysis report is compiling below.
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6 max-w-3xl mx-auto"
        >
          {dimensions.map((d, index) => (
            <motion.div key={d.dimension} variants={itemVariants}>
              <DimensionCard
                dimension={d.dimension}
                score={d.score}
                justification={d.justification}
                sourceExcerpt={d.source_excerpt}
                sourceFramework={d.source_framework}
                startDelay={index * 350}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Reset/CTA CTA Button */}
      <div className="text-center pt-4">
        <button
          onClick={onReset}
          className="px-8 py-3.5 rounded-full border-2 border-accent text-accent bg-transparent text-base font-medium transition-all duration-200 hover:bg-accent hover:text-accent-inverse active:scale-[0.98]"
        >
          Evaluate another idea
        </button>
      </div>
    </div>
  );
}
