"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PageTransition from "../components/PageTransition";
import {
  ResponsiveContainer,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

interface Dimension {
  dimension: string;
  score: number;
  justification: string;
  source_excerpt: string;
  source_framework: string;
  confidence: "high" | "medium" | "low";
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  evaluations?: Dimension[] | null;
  suggested_followups?: string[] | null;
}

interface MetricData {
  total_sessions: number;
  total_messages: number;
  global_average: number;
  dimension_averages: { dimension: string; score: number }[];
  score_distribution: { low: number; mid: number; high: number };
  recent_evaluations: {
    session_id: string;
    title: string;
    pitch: string;
    overall_score: number;
    created_at: string | null;
    message_count: number;
  }[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/* ===== Custom Markdown Helper: Parsers for bold & inline code ===== */
function parseTextWithFormatting(text: string) {
  let content = text;
  const starCount = (text.match(/\*\*/g) || []).length;
  if (starCount % 2 !== 0) {
    content = text + "**";
  }

  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  const tokens = content.split(regex);
  
  tokens.forEach((token, idx) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      const boldText = token.slice(2, -2);
      parts.push(
        <strong key={idx} className="font-bold text-text-primary">
          {boldText}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      const codeText = token.slice(1, -1);
      parts.push(
        <code key={idx} className="px-1 py-0.5 rounded bg-text-secondary/5 border border-border text-text-primary font-mono text-[11px] font-semibold tracking-tight mx-0.5 select-all">
          {codeText}
        </code>
      );
    } else {
      parts.push(token);
    }
  });

  return parts;
}

/* ===== Custom Markdown Renderer for bold, code, headings, quotes & lists ===== */
function renderMessageContent(text: string) {
  const paragraphs = text.split("\n\n");
  
  return paragraphs.map((para, pIdx) => {
    const cleanPara = para.trim();
    
    // Headings
    if (cleanPara.startsWith("### ")) {
      return (
        <h3 key={pIdx} className="font-heading text-xs font-bold text-text-primary tracking-tight mt-3 mb-1 first:mt-0">
          {parseTextWithFormatting(cleanPara.slice(4))}
        </h3>
      );
    }
    if (cleanPara.startsWith("## ")) {
      return (
        <h2 key={pIdx} className="font-heading text-sm font-bold text-text-primary tracking-tight mt-4 mb-1.5 first:mt-0">
          {parseTextWithFormatting(cleanPara.slice(3))}
        </h2>
      );
    }
    if (cleanPara.startsWith("# ")) {
      return (
        <h1 key={pIdx} className="font-heading text-base font-bold text-text-primary tracking-tight mt-5 mb-2 first:mt-0">
          {parseTextWithFormatting(cleanPara.slice(2))}
        </h1>
      );
    }

    // Blockquotes
    if (cleanPara.startsWith("> ")) {
      return (
        <blockquote key={pIdx} className="border-l-2 border-accent/25 pl-3 py-0.5 italic text-text-secondary my-2.5 bg-accent/[0.01] rounded-r-lg text-xs">
          {parseTextWithFormatting(cleanPara.slice(2))}
        </blockquote>
      );
    }

    // Horizontal Rule
    if (cleanPara === "---") {
      return <hr key={pIdx} className="border-border/60 my-3" />;
    }

    // Lists
    const lines = para.split("\n");
    const isList = lines.some(line => 
      line.trim().startsWith("•") || 
      line.trim().startsWith("*") || 
      line.trim().startsWith("-") || 
      /^\d+\.\s/.test(line.trim())
    );

    if (isList) {
      return (
        <div key={pIdx} className="space-y-1.5 my-2 pl-1">
          {lines.map((line, lIdx) => {
            const trimmedLine = line.trim();
            const isBullet = trimmedLine.startsWith("•") || trimmedLine.startsWith("*") || trimmedLine.startsWith("-");
            const isNumbered = /^\d+\.\s/.test(trimmedLine);
            
            let content = line;
            if (isBullet) {
              content = line.replace(/^\s*[•*-]\s*/, "");
            }
            
            let bulletNum = "";
            if (isNumbered) {
              const numMatch = line.match(/^\s*(\d+)\.\s*(.*)/);
              if (numMatch) {
                bulletNum = numMatch[1];
                content = numMatch[2];
              }
            }

            const parsedLine = parseTextWithFormatting(content);

            if (isBullet) {
              return (
                <div key={lIdx} className="flex items-start space-x-2 pl-3">
                  <span className="text-text-secondary select-none font-bold text-[12px] mt-0.5">•</span>
                  <span className="text-text-secondary text-xs leading-relaxed font-body font-medium flex-1">{parsedLine}</span>
                </div>
              );
            }
            if (isNumbered) {
              return (
                <div key={lIdx} className="flex items-start space-x-2 pl-1.5">
                  <span className="text-text-primary font-bold text-[11px] select-none mt-0.5">{bulletNum}.</span>
                  <span className="text-text-secondary text-xs leading-relaxed font-body font-medium flex-1">{parsedLine}</span>
                </div>
              );
            }
            return (
              <p key={lIdx} className="text-text-secondary text-xs leading-relaxed font-body font-medium pl-1">
                {parsedLine}
              </p>
            );
          })}
        </div>
      );
    }

    // Standard paragraph
    return (
      <p key={pIdx} className="text-text-primary text-xs leading-relaxed font-body font-medium my-1.5 first:mt-0 last:mb-0">
        {parseTextWithFormatting(para)}
      </p>
    );
  });
}

function getScoreColor(score: number): string {
  if (score >= 8.0) return "text-score-high bg-score-bg-high border-score-high/20";
  if (score >= 5.0) return "text-score-mid bg-score-bg-mid border-score-mid/20";
  return "text-score-low bg-score-bg-low border-score-low/20";
}

function formatDate(isoStr: string | null): string {
  if (!isoStr) return "N/A";
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

export default function AdminPage() {
  const [passcode, setPasscode] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("admin_secret_code") || "";
    }
    return "";
  });
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [metrics, setMetrics] = useState<MetricData | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Inspector Modal states
  const [sessionPitch, setSessionPitch] = useState<string>("");
  const [sessionScore, setSessionScore] = useState<number>(0);
  const [sessionChatHistory, setSessionChatHistory] = useState<ChatMessage[]>([]);
  const [sessionDossier, setSessionDossier] = useState<Dimension[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [modalTab, setModalTab] = useState<"chat" | "dossier">("chat");

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const fetchMetrics = useCallback(async (code: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/metrics?secret_code=${encodeURIComponent(code)}`);
      if (res.status === 200) {
        const data = await res.json();
        setMetrics(data);
        setIsAuthorized(true);
        sessionStorage.setItem("admin_secret_code", code);
      } else if (res.status === 401) {
        setError("Invalid passcode. Access Denied.");
        setIsAuthorized(false);
        sessionStorage.removeItem("admin_secret_code");
      } else {
        setError("Error communicating with metrics service.");
      }
    } catch {
      setError("Unable to connect to the backend server. Please verify backend is running on 127.0.0.1:8000.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Pre-login check if code is already stored
  useEffect(() => {
    const storedCode = sessionStorage.getItem("admin_secret_code");
    if (storedCode) {
      const timer = setTimeout(() => {
        fetchMetrics(storedCode);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [fetchMetrics]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;
    fetchMetrics(passcode);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_secret_code");
    setPasscode("");
    setIsAuthorized(false);
    setMetrics(null);
    setError(null);
  };

  const handleInspectSession = async (sessionId: string, pitch: string, score: number) => {
    setSessionPitch(pitch);
    setSessionScore(score);
    setIsHistoryLoading(true);
    setIsModalOpen(true);
    setModalTab("chat");
    setSessionChatHistory([]);
    setSessionDossier([]);

    try {
      const res = await fetch(`${API_URL}/api/chat/session/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSessionChatHistory(data.history || []);
        setSessionDossier(data.compiled_dossier || []);
      } else {
        console.error("Failed to load session history");
      }
    } catch (err) {
      console.error("Network error fetching session history", err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // Safe variables for radar charts
  const radarData = metrics?.dimension_averages.map((d) => ({
    subject: d.dimension,
    value: d.score,
    fullMark: 10,
  })) || [];

  return (
    <PageTransition>
      <div className="flex-grow flex flex-col pt-16 pb-12 px-6 sm:px-12 md:px-16 w-full max-w-7xl mx-auto min-h-screen">
        
        {/* Passcode Gatekeeper View */}
        {!isAuthorized ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-md p-8 sm:p-10 rounded-2xl border bg-surface/50 border-border backdrop-blur-xl shadow-card"
            >
              <div className="text-center space-y-3 mb-8">
                <div className="mx-auto w-12 h-12 rounded-xl bg-accent/5 border border-accent/10 flex items-center justify-center text-accent">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <h2 className="font-heading text-2xl font-bold tracking-tight text-text-primary">
                  Admin Console
                </h2>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Authentication is required to access startup metrics aggregates and dossier database logs.
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="passcode" className="text-[10px] font-bold uppercase tracking-wider text-text-secondary block">
                    Passcode Key
                  </label>
                  <input
                    id="passcode"
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter admin passcode"
                    className="w-full px-4 py-3 rounded-xl border border-border/80 bg-surface text-sm focus:outline-none focus:border-accent/35 focus:ring-3 focus:ring-accent/5 transition-all"
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-lg border border-score-low/10 bg-score-bg-low text-[11px] font-semibold text-score-low leading-relaxed"
                  >
                    {error}
                  </motion.div>
                )}

                <motion.button
                  type="submit"
                  disabled={isLoading || !passcode.trim()}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full py-3 rounded-xl bg-accent text-accent-inverse text-xs font-bold hover:bg-[#2b2b2b] transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Validating key...</span>
                    </>
                  ) : (
                    <span>Unlock Console</span>
                  )}
                </motion.button>
              </form>
            </motion.div>
          </div>
        ) : (
          /* Authorized Dashboard View */
          <div className="space-y-10">
            {/* Header Hero Area */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-6 gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary select-none">
                  Systems Operation Panel
                </span>
                <h1 className="font-heading text-3xl font-bold tracking-tight text-text-primary mt-1">
                  Evaluation Ledger
                </h1>
                <p className="text-xs text-text-secondary leading-relaxed mt-0.5">
                  Visual aggregates compiling global startup scores, key engagement ratios, and individual advisor logs.
                </p>
              </div>

              <div className="flex items-center space-x-3.5">
                <button
                  onClick={() => fetchMetrics(passcode)}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-xl border border-border bg-surface text-xs font-bold text-text-secondary hover:border-border-strong hover:text-text-primary transition-all duration-200 cursor-pointer flex items-center space-x-1.5"
                >
                  <svg className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  <span>Sync Ledger</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-xl bg-accent text-accent-inverse text-xs font-bold hover:bg-[#2b2b2b] transition-all duration-200 cursor-pointer flex items-center space-x-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <span>Lock Console</span>
                </button>
              </div>
            </div>

            {/* Metrics Grid Cards */}
            {metrics && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Card 1: Total sessions */}
                <div className="rounded-2xl border border-border/80 bg-surface/50 p-6 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.01)] hover:border-border transition-all duration-300">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                    Total Evaluated Pitches
                  </div>
                  <div className="mt-4 flex items-baseline justify-between">
                    <span className="font-heading text-4xl font-bold tracking-tight text-text-primary">
                      {metrics.total_sessions}
                    </span>
                    <span className="text-[10px] font-bold text-score-high bg-score-bg-high px-2 py-0.5 rounded border border-score-high/10">
                      Active
                    </span>
                  </div>
                </div>

                {/* Card 2: Total messages */}
                <div className="rounded-2xl border border-border/80 bg-surface/50 p-6 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.01)] hover:border-border transition-all duration-300">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                    Advisor Turn Counts
                  </div>
                  <div className="mt-4 flex items-baseline justify-between">
                    <span className="font-heading text-4xl font-bold tracking-tight text-text-primary">
                      {metrics.total_messages}
                    </span>
                    <span className="text-[10px] font-semibold text-text-secondary">
                      User + AI
                    </span>
                  </div>
                </div>

                {/* Card 3: Global average */}
                <div className="rounded-2xl border border-border/80 bg-surface/50 p-6 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.01)] hover:border-border transition-all duration-300">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                    Global Quality Average
                  </div>
                  <div className="mt-4 flex items-baseline justify-between">
                    <span className={`font-heading text-4xl font-bold tracking-tight ${
                      metrics.global_average >= 8.0 ? "text-score-high" : metrics.global_average >= 5.0 ? "text-score-mid" : "text-score-low"
                    }`}>
                      {metrics.global_average.toFixed(1)}<span className="text-text-secondary/50 text-xl">/10</span>
                    </span>
                    <span className="text-[10px] font-semibold text-text-secondary">
                      Weighted score
                    </span>
                  </div>
                </div>

                {/* Card 4: High score ratio */}
                <div className="rounded-2xl border border-border/80 bg-surface/50 p-6 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.01)] hover:border-border transition-all duration-300">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                    Tier-1 Startups Ratio
                  </div>
                  <div className="mt-4 flex items-baseline justify-between">
                    <span className="font-heading text-4xl font-bold tracking-tight text-text-primary">
                      {metrics.total_sessions > 0
                        ? Math.round((metrics.score_distribution.high / metrics.total_sessions) * 100)
                        : 0}%
                    </span>
                    <span className="text-[10px] font-bold text-score-high bg-score-bg-high px-2 py-0.5 rounded border border-score-high/10">
                      Score &gt;= 8.0
                    </span>
                  </div>
                </div>

              </div>
            )}

            {/* Graphs & Distributions Section */}
            {metrics && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Left Graph Card: Dimension averages */}
                <div className="rounded-2xl border border-border/80 bg-surface/40 backdrop-blur-xl p-6 flex flex-col min-h-[380px] shadow-[0_4px_24px_rgba(0,0,0,0.01)]">
                  <div className="border-b border-border/60 pb-3 mb-6">
                    <h3 className="font-heading text-base font-bold text-text-primary tracking-tight">
                      Aggregate Performance Profile
                    </h3>
                    <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                      Core evaluation dimension averages across all submitted ideas.
                    </p>
                  </div>

                  <div className="flex-1 flex items-center justify-center w-full min-h-[260px]">
                    {isMounted ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={260}>
                          <RechartsRadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                            <defs>
                              <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#0A0A0A" stopOpacity={0.1} />
                                <stop offset="100%" stopColor="#0A0A0A" stopOpacity={0.03} />
                              </linearGradient>
                            </defs>
                            <PolarGrid stroke="var(--color-border)" />
                            <PolarAngleAxis
                              dataKey="subject"
                              tick={{
                                fill: "var(--color-text-primary)",
                                fontSize: 10,
                                fontWeight: 500,
                                fontFamily: "var(--font-heading), sans-serif",
                              }}
                            />
                            <PolarRadiusAxis
                              angle={30}
                              domain={[0, 10]}
                              tickCount={6}
                              tick={{ fill: "var(--color-text-secondary)", fontSize: 9 }}
                            />
                            <Radar
                              name="Platform Average"
                              dataKey="value"
                              stroke="#0A0A0A"
                              strokeWidth={2}
                              fill="url(#radarFill)"
                              fillOpacity={1}
                              dot={{
                                r: 3,
                                fill: "#0A0A0A",
                                stroke: "#FFFFFF",
                                strokeWidth: 1.5,
                              }}
                            />
                          </RechartsRadarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="text-text-secondary text-xs">Loading profile data...</div>
                    )}
                  </div>
                </div>

                {/* Right Graph Card: Distribution with monochrome Progress bars */}
                <div className="rounded-2xl border border-border/80 bg-surface/40 backdrop-blur-xl p-6 flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.01)]">
                  <div className="border-b border-border/60 pb-3 mb-6">
                    <h3 className="font-heading text-base font-bold text-text-primary tracking-tight">
                      Startup Quality Segmentation
                    </h3>
                    <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                      Distribution of pitches bucketed by overall evaluation ratings.
                    </p>
                  </div>

                  <div className="flex-1 flex flex-col justify-center space-y-6">
                    {/* Segment 1: High */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline text-xs font-semibold">
                        <span className="text-score-high flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-score-high/20 border border-score-high/30 shrink-0" />
                          <span>Tier 1 (High Quality: 8.0 - 10.0)</span>
                        </span>
                        <span className="text-text-primary">
                          {metrics.score_distribution.high} pitches ({metrics.total_sessions > 0
                            ? Math.round((metrics.score_distribution.high / metrics.total_sessions) * 100)
                            : 0}%)
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-text-secondary/5 overflow-hidden border border-border/20">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${metrics.total_sessions > 0
                              ? (metrics.score_distribution.high / metrics.total_sessions) * 100
                              : 0}%`
                          }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="h-full bg-score-high"
                        />
                      </div>
                    </div>

                    {/* Segment 2: Mid */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline text-xs font-semibold">
                        <span className="text-score-mid flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-score-mid/20 border border-score-mid/30 shrink-0" />
                          <span>Tier 2 (Market Viable: 5.0 - 7.9)</span>
                        </span>
                        <span className="text-text-primary">
                          {metrics.score_distribution.mid} pitches ({metrics.total_sessions > 0
                            ? Math.round((metrics.score_distribution.mid / metrics.total_sessions) * 100)
                            : 0}%)
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-text-secondary/5 overflow-hidden border border-border/20">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${metrics.total_sessions > 0
                              ? (metrics.score_distribution.mid / metrics.total_sessions) * 100
                              : 0}%`
                          }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="h-full bg-score-mid"
                        />
                      </div>
                    </div>

                    {/* Segment 3: Low */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline text-xs font-semibold">
                        <span className="text-score-low flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-score-low/20 border border-score-low/30 shrink-0" />
                          <span>Tier 3 (Concept Phase: &lt; 5.0)</span>
                        </span>
                        <span className="text-text-primary">
                          {metrics.score_distribution.low} pitches ({metrics.total_sessions > 0
                            ? Math.round((metrics.score_distribution.low / metrics.total_sessions) * 100)
                            : 0}%)
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-text-secondary/5 overflow-hidden border border-border/20">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${metrics.total_sessions > 0
                              ? (metrics.score_distribution.low / metrics.total_sessions) * 100
                              : 0}%`
                          }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="h-full bg-score-low"
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Evaluations Ledger Table */}
            {metrics && (
              <div className="rounded-2xl border border-border/80 bg-surface/50 overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.01)]">
                <div className="px-6 py-5 border-b border-border/60 bg-surface/40">
                  <h3 className="font-heading text-base font-bold text-text-primary tracking-tight">
                    Submitted Startup Ledgers
                  </h3>
                  <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                    Overview of the last 50 evaluation sessions. Click Inspect to read conversation history transcripts.
                  </p>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-[10px] font-bold text-text-secondary bg-surface-hover/20 uppercase tracking-wider select-none">
                        <th className="py-4 px-6">Startup Pitch Concept</th>
                        <th className="py-4 px-6 text-center">Score</th>
                        <th className="py-4 px-6 text-center">Turns</th>
                        <th className="py-4 px-6">Date Evaluated</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-xs">
                      {metrics.recent_evaluations.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-text-secondary">
                            No startup ideas submitted yet.
                          </td>
                        </tr>
                      ) : (
                        metrics.recent_evaluations.map((evalItem) => (
                          <tr
                            key={evalItem.session_id}
                            className="hover:bg-surface-hover/15 transition-all group"
                          >
                            <td className="py-4.5 px-6 max-w-sm">
                              <div className="font-semibold text-text-primary truncate" title={evalItem.pitch}>
                                {evalItem.pitch}
                              </div>
                              <div className="text-[10px] text-text-tertiary mt-1 font-mono select-all">
                                ID: {evalItem.session_id}
                              </div>
                            </td>
                            <td className="py-4.5 px-6 text-center font-bold">
                              <span className={`px-2.5 py-1 rounded-full text-[11px] border font-bold ${getScoreColor(evalItem.overall_score)}`}>
                                {evalItem.overall_score > 0 ? evalItem.overall_score.toFixed(1) : "--"}
                              </span>
                            </td>
                            <td className="py-4.5 px-6 text-center font-semibold text-text-secondary">
                              {evalItem.message_count}
                            </td>
                            <td className="py-4.5 px-6 text-text-secondary font-medium">
                              {formatDate(evalItem.created_at)}
                            </td>
                            <td className="py-4.5 px-6 text-right">
                              <button
                                onClick={() => handleInspectSession(evalItem.session_id, evalItem.pitch, evalItem.overall_score)}
                                className="px-3 py-1.5 rounded-lg border border-border bg-surface text-[10.5px] font-bold text-text-secondary hover:border-accent hover:text-accent hover:bg-accent/5 transition-all duration-200 cursor-pointer inline-flex items-center space-x-1 shadow-sm opacity-90 group-hover:opacity-100"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>Inspect</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Session Inspector Drawer Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 backdrop-blur-sm p-4 sm:p-6 select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="bg-bg border border-border w-full max-w-5xl h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden select-text"
            >
              
              {/* Modal Header */}
              <div className="px-6 py-4.5 border-b border-border/80 bg-surface/50 flex justify-between items-center shrink-0">
                <div className="min-w-0 pr-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary select-none">
                      Session Transcript Inspector
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getScoreColor(sessionScore)}`}>
                      Overall: {sessionScore > 0 ? sessionScore.toFixed(1) : "--"}
                    </span>
                  </div>
                  <h3 className="font-heading text-base font-bold text-text-primary truncate mt-1 leading-snug">
                    {sessionPitch}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-lg border border-border bg-surface text-text-secondary hover:text-text-primary hover:border-border-strong transition-all flex items-center justify-center cursor-pointer shadow-sm"
                  title="Close Inspector"
                >
                  ✕
                </button>
              </div>

              {/* Modal Tab Switcher */}
              <div className="px-6 py-2 bg-surface/20 border-b border-border/60 shrink-0 flex space-x-4">
                <button
                  onClick={() => setModalTab("chat")}
                  className={`px-3 py-2 text-xs font-bold transition-all relative ${
                    modalTab === "chat" ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Chat History ({sessionChatHistory.length})
                  {modalTab === "chat" && (
                    <motion.div
                      layoutId="modal-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"
                    />
                  )}
                </button>
                <button
                  onClick={() => setModalTab("dossier")}
                  className={`px-3 py-2 text-xs font-bold transition-all relative ${
                    modalTab === "dossier" ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Compiled Dossier ({sessionDossier.length})
                  {modalTab === "dossier" && (
                    <motion.div
                      layoutId="modal-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"
                    />
                  )}
                </button>
              </div>

              {/* Modal Content Workspace */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-surface/5">
                {isHistoryLoading ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-3">
                    <svg className="animate-spin h-7 w-7 text-accent/70" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-xs font-bold text-text-secondary">Retrieving logs from database...</span>
                  </div>
                ) : (
                  <>
                    {/* Tab 1: Chat history bubbles */}
                    {modalTab === "chat" && (
                      <div className="space-y-6 max-w-4xl mx-auto">
                        {sessionChatHistory.length === 0 ? (
                          <div className="text-center text-text-secondary text-xs py-10 font-medium">
                            No conversation transcript recorded for this session.
                          </div>
                        ) : (
                          sessionChatHistory.map((msg, index) => {
                            const isUser = msg.role === "user";
                            return (
                              <div
                                key={index}
                                className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-4`}
                              >
                                <div className={`flex items-start space-x-3.5 max-w-[90%] ${isUser ? "flex-row-reverse space-x-reverse" : "flex-row"}`}>
                                  
                                  {/* Avatar */}
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border select-none ${
                                    isUser
                                      ? "bg-accent/5 border-accent/15 text-accent font-bold text-xs"
                                      : "bg-gradient-to-tr from-accent to-[#2b2b2b] border-[#1a1a1a] text-white"
                                  }`}>
                                    {isUser ? <span>U</span> : (
                                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l3.582-2.149 3.581 2.15-.985-5.097 3.916-3.41-5.228-.432L12 3 9.73 7.863l-5.228.432 3.916 3.41z" />
                                      </svg>
                                    )}
                                  </div>

                                  {/* Message Body */}
                                  <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                                    <div className="px-1 mb-1">
                                      <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider select-none">
                                        {isUser ? "You" : "Advisor"}
                                      </span>
                                    </div>
                                    <div
                                      className={`text-xs leading-relaxed transition-all p-3 rounded-2xl ${
                                        isUser
                                          ? "bg-surface border border-border/80 text-text-primary rounded-tr-sm shadow-[0_1px_2px_rgba(0,0,0,0.015)]"
                                          : "bg-transparent text-text-primary border-transparent border-0 pl-0 pt-0"
                                      }`}
                                    >
                                      {isUser ? (
                                        <p className="whitespace-pre-wrap font-body font-medium">{msg.content}</p>
                                      ) : (
                                        <div className="w-full relative">
                                          <div className="inline-block w-full">{renderMessageContent(msg.content)}</div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Dimension evaluation sub-scores inside the message */}
                                    {!isUser && msg.evaluations && msg.evaluations.length > 0 && (
                                      <div className="flex flex-wrap gap-2.5 mt-3 select-none">
                                        {msg.evaluations.map((ev, eIdx) => (
                                          <span
                                            key={eIdx}
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide flex items-center space-x-1 ${getScoreColor(ev.score)}`}
                                          >
                                            <span>{ev.dimension}:</span>
                                            <span className="font-extrabold">{ev.score}</span>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* Tab 2: Compiled dossier details */}
                    {modalTab === "dossier" && (
                      <div className="space-y-6 max-w-4xl mx-auto">
                        {sessionDossier.length === 0 ? (
                          <div className="text-center text-text-secondary text-xs py-10 font-medium">
                            No evaluation dimensions scored for this session yet. Continue discussion to score.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {sessionDossier.map((dim) => (
                              <div
                                key={dim.dimension}
                                className="rounded-2xl border border-border/80 bg-surface/50 p-5 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.01)] hover:border-border transition-all"
                              >
                                <div className="space-y-3.5">
                                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                                    <h4 className="font-heading text-sm font-bold text-text-primary">
                                      {dim.dimension}
                                    </h4>
                                    <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold border ${getScoreColor(dim.score)}`}>
                                      Score: {dim.score}/10
                                    </span>
                                  </div>

                                  <div className="space-y-2">
                                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-text-secondary block">
                                      Justification
                                    </span>
                                    <p className="text-xs text-text-primary leading-relaxed font-body font-medium">
                                      {dim.justification}
                                    </p>
                                  </div>

                                  {dim.source_excerpt && (
                                    <div className="pt-2 space-y-1.5">
                                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-text-secondary block">
                                        Source Citation
                                      </span>
                                      <div className="bg-text-secondary/5 border border-border/60 rounded-xl p-3 text-[10.5px] text-text-secondary font-mono italic leading-relaxed whitespace-pre-wrap">
                                        &ldquo;{dim.source_excerpt}&rdquo;
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {dim.source_framework && (
                                  <div className="mt-4 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] font-bold text-text-tertiary">
                                    <span className="uppercase tracking-wider">Framework Cited</span>
                                    <span className="text-text-primary select-all">{dim.source_framework}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-border bg-surface/30 flex justify-end shrink-0 select-none">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-accent text-accent-inverse text-xs font-bold hover:bg-[#2b2b2b] transition-all cursor-pointer shadow-sm"
                >
                  Close Transcripts
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </PageTransition>
  );
}
