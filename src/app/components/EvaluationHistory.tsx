"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface HistoryEntry {
  id: string;
  ideaSnippet: string;
  overallScore: number;
  dimensionScores: { dimension: string; score: number }[];
  timestamp: number;
}

const HISTORY_KEY = "z_combinator_history";
const MAX_ENTRIES = 10;

export function saveEvaluation(
  ideaSnippet: string,
  overallScore: number,
  dimensionScores: { dimension: string; score: number }[]
) {
  try {
    const existing = getHistory();
    const entry: HistoryEntry = {
      id: `eval_${Date.now()}`,
      ideaSnippet: ideaSnippet.slice(0, 120) + (ideaSnippet.length > 120 ? "..." : ""),
      overallScore,
      dimensionScores,
      timestamp: Date.now(),
    };
    const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to save evaluation history", err);
  }
}

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getScoreColor(score: number): string {
  if (score >= 8) return "text-score-high";
  if (score >= 5) return "text-score-mid";
  return "text-score-low";
}

interface EvaluationHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EvaluationHistory({ isOpen, onClose }: EvaluationHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (isOpen) {
      setHistory(getHistory());
    }
  }, [isOpen]);

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-full w-[340px] max-w-[90vw] bg-surface border-l border-border z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-heading text-base font-bold text-text-primary tracking-tight">
                Past Evaluations
              </h2>
              <div className="flex items-center space-x-2">
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-[10px] font-bold text-text-tertiary hover:text-score-low transition-colors"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1 text-text-secondary hover:text-text-primary transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2">
                  <svg className="w-10 h-10 text-text-tertiary" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-text-secondary text-xs font-medium">
                    No past evaluations yet. Complete a chat evaluation to see it here.
                  </p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ staggerChildren: 0.05 }}
                >
                  {history.map((entry, i) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-xl border border-border bg-surface p-3 space-y-2 hover:shadow-card transition-all duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <p className="text-xs text-text-primary font-medium leading-relaxed line-clamp-2 flex-1 mr-2">
                          {entry.ideaSnippet}
                        </p>
                        <span className={`font-heading text-lg font-bold tracking-tight ${getScoreColor(entry.overallScore)} shrink-0`}>
                          {entry.overallScore}
                        </span>
                      </div>

                      {/* Mini dimension scores */}
                      <div className="flex flex-wrap gap-1">
                        {entry.dimensionScores.map((ds) => (
                          <span
                            key={ds.dimension}
                            className={`text-[8px] font-bold rounded px-1.5 py-0.5 ${getScoreColor(ds.score)} bg-border/30`}
                          >
                            {ds.dimension.slice(0, 3).toUpperCase()}: {ds.score}
                          </span>
                        ))}
                      </div>

                      <span className="text-[9px] text-text-tertiary block">
                        {formatDate(entry.timestamp)}
                      </span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
