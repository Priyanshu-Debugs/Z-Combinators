"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, SignInButton } from "@clerk/nextjs";

interface HistoryEntry {
  id: string;
  ideaSnippet: string;
  overallScore: number;
  dimensionScores: { dimension: string; score: number }[];
  timestamp: number;
}

interface ServerSession {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  message_count: number;
  latest_score?: number | null;
}

const HISTORY_KEY = "z_combinator_history";
const MAX_ENTRIES = 10;
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

function formatDate(dateInput: number | string): string {
  const d = new Date(dateInput);
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
  onSelectSession?: (sessionId: string) => void;
}

export default function EvaluationHistory({
  isOpen,
  onClose,
  onSelectSession,
}: EvaluationHistoryProps) {
  const { isSignedIn, getToken } = useAuth();
  const [localHistory, setLocalHistory] = useState<HistoryEntry[]>([]);
  const [serverSessions, setServerSessions] = useState<ServerSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchServerSessions = useCallback(async () => {
    if (!isSignedIn) return;
    setIsLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/v1/chat/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setServerSessions(data);
      }
    } catch (err) {
      console.warn("Failed to fetch sessions from server", err);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (isOpen) {
      if (isSignedIn) {
        fetchServerSessions();
      } else {
        setLocalHistory(getHistory());
      }
    }
  }, [isOpen, isSignedIn, fetchServerSessions]);

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSignedIn) return;
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/v1/chat/session/${sessionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setServerSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  };

  const handleSelect = (sessionId: string) => {
    if (onSelectSession) {
      onSelectSession(sessionId);
    }
    onClose();
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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ opacity: 0, x: 320 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 320 }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            className="fixed top-0 right-0 h-full w-[360px] max-w-[90vw] bg-surface/95 backdrop-blur-xl border-l border-border z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="font-heading text-base font-bold text-text-primary tracking-tight">
                  Pitch Dossier History
                </h2>
                <p className="text-[11px] text-text-secondary">
                  {isSignedIn ? "Saved evaluations in your account" : "Local browser history"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-border/30 transition-colors"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Unauthenticated Sync Banner */}
            {!isSignedIn && (
              <div className="p-3 m-3 rounded-xl bg-border/20 border border-border text-center space-y-2">
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Sign in with Google or Email to automatically sync and resume your pitch evaluations across devices.
                </p>
                <SignInButton mode="modal">
                  <button className="px-3 py-1 rounded-lg bg-white text-black font-heading text-xs font-semibold hover:bg-zinc-200 transition">
                    Sign In
                  </button>
                </SignInButton>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-48 space-y-3">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-text-secondary font-medium">Loading your pitch sessions...</p>
                </div>
              ) : isSignedIn ? (
                serverSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center p-6 space-y-2">
                    <svg className="w-8 h-8 text-text-tertiary" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-text-secondary text-xs font-medium">
                      No saved pitch evaluations yet. Start a chat evaluation to see it here!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {serverSessions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => handleSelect(s.id)}
                        className="group relative rounded-xl border border-border bg-surface p-3 space-y-2 hover:border-accent/40 hover:shadow-card transition-all duration-200 cursor-pointer"
                      >
                        <div className="flex items-start justify-between">
                          <h3 className="text-xs font-semibold text-text-primary group-hover:text-accent transition-colors line-clamp-1 flex-1 pr-2">
                            {s.title}
                          </h3>
                          {s.latest_score !== null && s.latest_score !== undefined && (
                            <span className={`font-heading text-sm font-bold ${getScoreColor(s.latest_score)}`}>
                              {s.latest_score.toFixed(1)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-text-tertiary pt-1 border-t border-border/30">
                          <span>{s.message_count} messages • {formatDate(s.updated_at || s.created_at)}</span>
                          <button
                            onClick={(e) => handleDeleteSession(s.id, e)}
                            className="opacity-0 group-hover:opacity-100 hover:text-score-low transition-all p-0.5"
                            title="Delete session"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : localHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center p-6 space-y-2">
                  <p className="text-text-secondary text-xs font-medium">
                    No past evaluations found.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {localHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-border bg-surface p-3 space-y-2 hover:shadow-card transition-all duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <p className="text-xs text-text-primary font-medium leading-relaxed line-clamp-2 flex-1 mr-2">
                          {entry.ideaSnippet}
                        </p>
                        <span className={`font-heading text-sm font-bold ${getScoreColor(entry.overallScore)}`}>
                          {entry.overallScore}
                        </span>
                      </div>
                      <span className="text-[9px] text-text-tertiary block">
                        {formatDate(entry.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
