"use client";

import { motion } from "framer-motion";

interface DimensionCardProps {
  dimension: string;
  score: number;
  justification: string;
  sourceExcerpt?: string;
  sourceFramework?: string;
  confidence?: "high" | "medium" | "low";
  onPromptClick?: (prompt: string) => void;
  startDelay?: number;
}

const DIMENSION_PROMPTS: Record<string, string> = {
  market: "Help me analyze our Total Addressable Market (TAM), customer persona, and target segment size.",
  team: "What details about our founding team's domain expertise and technical background would improve our score?",
  timing: "Analyze the macro trends, technological inflection points, and 'Why Now' drivers for this idea.",
  competition: "How can we refine our competitive matrix and clearly articulate our wedge against incumbents?",
  moat: "Suggest defensible moats, network effects, or data flywheels we can construct for this business.",
  execution: "Review our go-to-market plan, distribution channel strategy, and initial pricing model.",
};

export default function DimensionCard({
  dimension,
  score,
  justification,
  sourceExcerpt,
  sourceFramework,
  confidence = "medium",
  onPromptClick,
  startDelay = 0,
}: DimensionCardProps) {
  const isScored = score > 0;

  const getColorClasses = (s: number) => {
    if (!isScored) {
      return {
        border: "border-l-4 border-l-neutral-300",
        badge: "bg-neutral-100 text-neutral-600 border border-neutral-200",
      };
    }
    if (s >= 8) {
      return {
        border: "border-l-4 border-l-emerald-600",
        badge: "bg-emerald-50 text-emerald-800 border border-emerald-200",
      };
    }
    if (s >= 5) {
      return {
        border: "border-l-4 border-l-amber-500",
        badge: "bg-amber-50 text-amber-800 border border-amber-200",
      };
    }
    return {
      border: "border-l-4 border-l-rose-500",
      badge: "bg-rose-50 text-rose-800 border border-rose-200",
    };
  };

  const getConfidenceBadge = (conf: "high" | "medium" | "low") => {
    if (conf === "high") {
      return (
        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
          High Confidence
        </span>
      );
    }
    if (conf === "low") {
      return (
        <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200 text-[10px] font-semibold">
          Preliminary Info
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">
        Moderate Confidence
      </span>
    );
  };

  const colors = getColorClasses(score);
  const promptSuggestion = DIMENSION_PROMPTS[dimension.toLowerCase()] || `Help me improve the ${dimension} score.`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: startDelay }}
      className={`rounded-2xl border border-black/8 bg-white p-5 space-y-4 shadow-xs transition-all duration-200 hover:shadow-md ${colors.border}`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between pb-3 border-b border-black/6">
        <div className="flex items-center space-x-2.5">
          <h3 className="font-heading text-base font-bold text-[#0A0A0A] tracking-tight">
            {dimension}
          </h3>
          {isScored && getConfidenceBadge(confidence)}
        </div>

        <span className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wider ${colors.badge}`}>
          {isScored ? `${score}/10` : "Unscored (0/10)"}
        </span>
      </div>

      {/* Analysis Content */}
      <div className="space-y-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">
            Advisor Evaluation
          </span>
          <p className="text-xs text-neutral-700 leading-relaxed font-body font-medium whitespace-pre-wrap">
            {isScored ? justification : `No evaluation details available yet. Discuss your ${dimension.toLowerCase()} in chat to generate this score.`}
          </p>
        </div>

        {/* Framework Citation context */}
        {isScored && sourceFramework && (
          <div className="pt-2 border-t border-black/6 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center space-x-1">
              <span>📚</span>
              <span>Retrieved Institutional Framework</span>
            </span>
            <div className="border-l-2 border-[#0A0A0A] bg-[#F9F9F8] rounded-r-lg pl-3 pr-3 py-2 text-xs text-neutral-700 italic leading-relaxed">
              {sourceExcerpt && <p className="mb-1 text-neutral-800">&quot;{sourceExcerpt}&quot;</p>}
              <span className="not-italic text-[11px] font-semibold text-black">
                Source: {sourceFramework}
              </span>
            </div>
          </div>
        )}

        {/* Action Prompt to elevate score */}
        <div className="pt-2 flex items-center justify-between">
          <button
            onClick={() => onPromptClick?.(promptSuggestion)}
            className="inline-flex items-center space-x-1.5 text-[11px] font-semibold text-neutral-600 hover:text-black transition group cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 group-hover:bg-black transition-colors" />
            <span>{isScored ? `Elevate ${dimension} score →` : `Unlock ${dimension} evaluation →`}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
