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
    scoredMap.has(name.toLowerCase())
  ).length;

  return (
    <div className="flex items-center space-x-2">
      {/* Dimension dots */}
      <div className="flex items-center space-x-1.5">
        {ALL_DIMENSIONS.map((name) => {
          const score = scoredMap.get(name.toLowerCase());
          const isScored = score !== undefined;

          return (
            <div key={name} className="relative group">
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: isScored ? "#0A0A0A" : "rgba(0,0,0,0.06)",
                  scale: isScored ? 1 : 0.85,
                }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-2.5 h-2.5 rounded-full cursor-default"
                style={{
                  boxShadow: isScored ? "0 0 8px rgba(0, 0, 0, 0.15)" : "none",
                }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-accent text-accent-inverse text-[9px] font-bold rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md z-10">
                {name}{isScored ? `: ${score}` : ""}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="flex-1 h-1.5 bg-border/50 rounded-full overflow-hidden max-w-[80px]">
        <div
          className="h-full progress-fill rounded-full"
          style={{ width: `${(scoredCount / 6) * 100}%` }}
        />
      </div>

      {/* Count */}
      <span className="text-[9px] font-bold text-text-secondary tracking-wider">
        {scoredCount}/6
      </span>
    </div>
  );
}
