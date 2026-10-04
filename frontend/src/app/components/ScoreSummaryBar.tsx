"use client";

import { motion } from "framer-motion";

interface ScoreSummaryBarProps {
  dimensions: {
    dimension: string;
    score: number;
  }[];
}

const ALL_DIMENSIONS = ["Market", "Team", "Timing", "Competition", "Moat", "Execution"];

export default function ScoreSummaryBar({ dimensions }: ScoreSummaryBarProps) {
  const scoredMap = new Map<string, number>();
  dimensions.forEach((d) => {
    scoredMap.set(d.dimension.toLowerCase(), d.score);
  });

  const scoredCount = ALL_DIMENSIONS.filter((name) =>
    (scoredMap.get(name.toLowerCase()) || 0) > 0
  ).length;

  const getDotColor = (score?: number) => {
    if (!score || score <= 0) return "#E4E4E7";
    if (score >= 8) return "#059669";
    if (score >= 5) return "#D97706";
    return "#E11D48";
  };

  return (
    <div className="flex items-center space-x-3 bg-white border border-black/10 px-3 py-1.5 rounded-xl shadow-xs select-none">
      {/* Dimension dots with tooltips */}
      <div className="flex items-center space-x-1.5">
        {ALL_DIMENSIONS.map((name) => {
          const score = scoredMap.get(name.toLowerCase());
          const isScored = score !== undefined && score > 0;
          const color = getDotColor(score);

          return (
            <div key={name} className="relative group">
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: color,
                  scale: isScored ? 1.05 : 0.85,
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-2.5 h-2.5 rounded-full cursor-pointer transition-shadow"
                style={{
                  boxShadow: isScored ? `0 0 6px ${color}50` : "none",
                }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#0A0A0A] text-white text-[10px] font-semibold rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-lg z-50">
                {name}: {isScored ? `${score}/10` : "Unscored"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress line */}
      <div className="w-14 sm:w-16 h-1.5 bg-neutral-100 rounded-full overflow-hidden border border-black/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(scoredCount / 6) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full bg-[#0A0A0A] rounded-full"
        />
      </div>

      {/* Scored Count Badge */}
      <span className="text-[10px] font-bold text-neutral-600 font-mono tracking-wider">
        {scoredCount}/6
      </span>
    </div>
  );
}
