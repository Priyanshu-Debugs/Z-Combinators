"use client";

import { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PageTransition from "../components/PageTransition";
import ChatInterface from "../components/ChatInterface";
import EvaluateResults from "../components/EvaluateResults";
import Disclaimer from "../components/Disclaimer";
import ScoreSummaryBar from "../components/ScoreSummaryBar";
import EvaluationHistory, { saveEvaluation } from "../components/EvaluationHistory";
import jsPDF from "jspdf";
import RadarChart from "../components/RadarChart";

interface Dimension {
  dimension: string;
  score: number;
  justification: string;
  source_excerpt: string;
  source_framework: string;
  confidence: "high" | "medium" | "low";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const WELCOME_MESSAGE = {
  role: "assistant" as const,
  content:
    "Hi! I'm your Startup Advisor. To help me evaluate your startup idea with the best results, tell me about:\n\n" +
    "1. **Market**: Who is your customer base and what is the market size?\n" +
    "2. **Team**: Who is on the founding team and what is their domain expertise?\n" +
    "3. **Competition**: Who are your main competitors and how do you differentiate?\n" +
    "4. **Moat**: What is your unfair advantage, defensibility, or network effects?\n" +
    "5. **Execution**: What is your go-to-market plan, pricing, and distribution model?\n\n" +
    "Don't worry if you don't know the **Timing** (why now is the right time, macro trends, or tech shifts) — I will analyze your industry/concept and suggest/evaluate the timing dimension for you!\n\n" +
    "You can describe your startup idea in a few sentences, or answer any of these specific dimensions to start!",
  suggested_followups: [
    "Evaluate my AI SaaS startup idea",
    "What details do you need for a full evaluation?",
    "Explain the scoring methodology"
  ]
};

function EvaluateContent() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string; suggested_followups?: string[]; wasStreamed?: boolean }[]>([
    WELCOME_MESSAGE,
  ]);
  const [dossier, setDossier] = useState<Dimension[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "dossier">("chat");
  const [showHistory, setShowHistory] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportViewMode, setReportViewMode] = useState<"prompt" | "preview">("prompt");
  const [isExporting, setIsExporting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkSize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      setLeftWidth(Math.max(25, Math.min(75, newLeftWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize or retry session
  const initSession = useCallback(async () => {
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/chat/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.session_id);
        setMessages([WELCOME_MESSAGE]);
        setDossier([]);
        setError(null);
        if (retryTimerRef.current) {
          clearInterval(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        return true;
      }
    } catch (err) {
      console.warn("Advisor service is currently booting up, retrying...", err);
    }
    return false;
  }, []);

  useEffect(() => {
    let retryTimer: NodeJS.Timeout | null = null;
    
    const tryConnect = async () => {
      const success = await initSession();
      if (!success) {
        retryTimer = setInterval(async () => {
          const ok = await initSession();
          if (ok && retryTimer) {
            clearInterval(retryTimer);
            retryTimer = null;
          }
        }, 6000);
      }
    };
    
    tryConnect();
    
    return () => {
      if (retryTimer) clearInterval(retryTimer);
    };
  }, [initSession]);

  // Save evaluation to history when dimensions change significantly
  useEffect(() => {
    const validDossier = dossier.filter((d) => d.score > 0);
    if (validDossier.length >= 1 && messages.length > 0) {
      const firstUserMsg = messages.find((m) => m.role === "user");
      if (firstUserMsg) {
        const overallScore = Math.round(
          (validDossier.reduce((acc, d) => acc + d.score, 0) / validDossier.length) * 10
        ) / 10;
        saveEvaluation(
          firstUserMsg.content,
          overallScore,
          dossier.map((d) => ({ dimension: d.dimension, score: d.score }))
        );
      }
    }
  }, [dossier, messages]);

  const handleSendMessage = async (content: string) => {
    if (!sessionId) {
      setError("Advisor service is currently booting up. Please wait, attempting to establish connection...");
      initSession();
      return;
    }

    setIsLoading(true);
    setError(null);

    const updatedMessages = [...messages, { role: "user" as const, content }];
    setMessages(updatedMessages);

    try {
      const res = await fetch(`${API_URL}/api/chat/message/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, content }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("Rate limit reached. Please wait a moment before asking again.");
        }
        throw new Error("Failed to evaluate message. Please try again.");
      }

      if (!res.body) {
        throw new Error("Failed to initialize response stream.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let streamFinished = false;
      let assistantReply = "";

      // Append initial empty assistant message that will be populated via stream
      setMessages([...updatedMessages, { role: "assistant" as const, content: "" }]);

      let buffer = "";

      while (!streamFinished) {
        const { value, done } = await reader.read();
        if (done) {
          streamFinished = true;
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process SSE lines
        const lines = buffer.split("\n\n");
        // Keep the last partial line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.slice(6).trim();
            if (!dataStr) continue;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === "token") {
                assistantReply += parsed.content;
                setMessages((prev) => {
                  const next = [...prev];
                  if (next.length > 0) {
                    next[next.length - 1] = {
                      ...next[next.length - 1],
                      content: assistantReply,
                    };
                  }
                  return next;
                });
              } else if (parsed.type === "done") {
                setDossier(parsed.compiled_dossier);
                setMessages((prev) => {
                  const next = [...prev];
                  if (next.length > 0 && next[next.length - 1].role === "assistant") {
                    next[next.length - 1] = {
                      ...next[next.length - 1],
                      suggested_followups: parsed.suggested_followups,
                      wasStreamed: true,
                    };
                  }
                  return next;
                });
                streamFinished = true;
              } else if (parsed.type === "error") {
                throw new Error(parsed.content);
              }
            } catch (jsonErr) {
              console.warn("Failed to parse SSE line", jsonErr, trimmed);
            }
          }
        }
      }
    } catch (err) {
      const isConnectionRefused = err instanceof Error && (
        err.message.includes("Failed to fetch") || 
        err.message.includes("NetworkError") || 
        err.message.includes("refused")
      );
      
      const professionalErrorMsg = isConnectionRefused 
        ? "We apologize for the inconvenience. Our connection to the evaluation service was interrupted or the server is temporarily offline. Please verify that the backend is running and try again."
        : (err instanceof Error ? err.message : "We are sorry for the inconvenience, but an unexpected error occurred while processing your request.");

      setError(professionalErrorMsg);
      setMessages([
        ...updatedMessages,
        {
          role: "assistant" as const,
          content: professionalErrorMsg
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = async () => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/chat/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.session_id);
        setMessages([WELCOME_MESSAGE]);
        setDossier([]);
      }
    } catch {
      setError("Failed to start new chat.");
    }
  };

  const handleExportReport = () => {
    setReportViewMode("prompt");
    setIsReportModalOpen(true);
  };

  const getRadarChartImage = (): Promise<string | null> => {
    return new Promise((resolve) => {
      const svgElement = document.querySelector("#evaluation-radar-chart svg");
      if (!svgElement) {
        resolve(null);
        return;
      }

      try {
        const svgString = new XMLSerializer().serializeToString(svgElement);
        
        // Resolve CSS variables in SVG for isolated image rendering
        const getStyleVal = (varName: string, fallback: string) => {
          if (typeof window === "undefined") return fallback;
          return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;
        };
        
        const borderCol = getStyleVal("--color-border", "rgba(0, 0, 0, 0.08)");
        const textPrimaryCol = getStyleVal("--color-text-primary", "#0A0A0A");
        const textSecondaryCol = getStyleVal("--color-text-secondary", "#6B6B6B");
        
        const styledSvgString = svgString
          .replace(/var\(--color-border\)/g, borderCol)
          .replace(/var\(--color-text-primary\)/g, textPrimaryCol)
          .replace(/var\(--color-text-secondary\)/g, textSecondaryCol);

        const svgBlob = new Blob([styledSvgString], { type: "image/svg+xml;charset=utf-8" });
        const URL = window.URL || window.webkitURL || window;
        const blobURL = URL.createObjectURL(svgBlob);
        
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement("canvas");
          // Scale up for high-resolution PDF rendering
          canvas.width = (svgElement.clientWidth || 320) * 2;
          canvas.height = (svgElement.clientHeight || 320) * 2;
          const context = canvas.getContext("2d");
          if (context) {
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            const imgData = canvas.toDataURL("image/png");
            resolve(imgData);
          } else {
            resolve(null);
          }
          URL.revokeObjectURL(blobURL);
        };
        image.onerror = () => {
          resolve(null);
          URL.revokeObjectURL(blobURL);
        };
        image.src = blobURL;
      } catch (err) {
        console.error("Failed to generate radar chart PNG", err);
        resolve(null);
      }
    });
  };

  const buildPdf = (radarImg: string | null) => {
    // Only average dimensions that have score > 0
    const validDossier = dossier.filter(d => d.score > 0);
    const calculatedOverall = validDossier.length > 0
      ? Math.round(
          (validDossier.reduce((acc, d) => acc + d.score, 0) / validDossier.length) * 10
        ) / 10
      : 0;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // PAGE 1: COVER & RADAR CHART OVERVIEW
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Z-Combinators", 20, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text("Startup Evaluation & Advisor Report", 20, y);
    y += 6;

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, y);
    y += 10;

    // Draw horizontal separator line
    doc.setDrawColor(220, 220, 220);
    doc.line(20, y, pageWidth - 20, y);
    y += 12;

    // Overall Score Banner
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(`Overall Score: ${calculatedOverall}/10`, 20, y);
    y += 8;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Based on ${validDossier.length} of 6 evaluated dimensions`, 20, y);
    y += 15;

    // Embed Radar Chart Graph
    if (radarImg) {
      const chartWidth = 90;
      const chartHeight = 90;
      const chartX = (pageWidth - chartWidth) / 2;
      doc.addImage(radarImg, "PNG", chartX, y, chartWidth, chartHeight);
      y += chartHeight + 15;
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("[Radar Chart Visualization]", (pageWidth - 50) / 2, y + 20);
      y += 50;
    }

    // Professional Footer on cover page
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    const footerText = "This dossier evaluates the pitch against foundational models of startup success (Market, Team, Timing, Competition, Moat, Execution) derived from institutional benchmarks.";
    const footerLines = doc.splitTextToSize(footerText, pageWidth - 40);
    doc.text(footerLines, 20, y);

    // PAGE 2: DIMENSION SCORE DETAILS
    doc.addPage();
    y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Dimension Score Summary", 20, y);
    y += 10;

    dossier.forEach((d) => {
      if (y > 265) {
        doc.addPage();
        y = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const isScored = d.score > 0;
      doc.setTextColor(0, 0, 0);
      doc.text(`${d.dimension}: ${isScored ? `${d.score}/10` : "Pending Info (0/10)"}`, 20, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(60, 60, 60);

      const justificationText = isScored 
        ? d.justification 
        : `No evaluation yet. Share details about your startup's ${d.dimension.toLowerCase()} in the chat.`;
      
      const lines = doc.splitTextToSize(justificationText, pageWidth - 40);
      doc.text(lines, 20, y);
      y += lines.length * 4.5 + 4;

      if (isScored) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Framework Citation: ${d.source_framework}`, 20, y);
        y += 8;
      }
      y += 2;
    });

    // PAGE 3: CHAT TRANSCRIPT
    doc.addPage();
    y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Advisor Chat Transcript", 20, y);
    y += 10;

    messages.forEach((msg) => {
      if (y > 265) {
        doc.addPage();
        y = 20;
      }

      const label = msg.role === "user" ? "YOU" : "ADVISOR";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(msg.role === "user" ? 60 : 0, msg.role === "user" ? 110 : 0, msg.role === "user" ? 200 : 0);
      doc.text(label, 20, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      const msgLines = doc.splitTextToSize(msg.content, pageWidth - 40);
      doc.text(msgLines, 20, y);
      y += msgLines.length * 4.5 + 8;
    });

    doc.save(`z-combinator-report-${Date.now()}.pdf`);
  };

  // Compute overallScore for tab badge
  const scoredMap = new Map<string, Dimension>();
  dossier.forEach((d) => {
    scoredMap.set(d.dimension.toLowerCase(), d);
  });
  const ALL_DIMENSIONS = ["Market", "Team", "Timing", "Competition", "Moat", "Execution"];
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

  return (
    <PageTransition>
      <div className="flex-grow flex flex-col pt-14 pb-0 px-0 mx-0 w-full max-w-full h-[calc(100dvh-92px)] min-h-[550px] overflow-hidden">
        {/* Connection status bar */}
        <AnimatePresence>
          {!sessionId && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex-shrink-0 bg-black text-white text-[11px] font-medium py-2 px-6 flex items-center justify-center space-x-2 w-full select-none"
            >
              <svg className="animate-spin h-3.5 w-3.5 text-white/80" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Connecting to the backend. Getting ready might take 1-2 minutes...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex-shrink-0 mx-6 mt-4 p-3.5 rounded-xl border border-border bg-surface/50 text-text-primary text-xs flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
            >
              <div className="flex items-center space-x-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-text-secondary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-text-secondary"></span>
                </span>
                <span className="font-medium text-text-secondary leading-relaxed">{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-text-secondary hover:text-text-primary font-bold hover:opacity-80 ml-4 cursor-pointer"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Master Workspace Console Box */}
        <div
          ref={containerRef}
          className={`flex-grow w-full border-t border-b border-border bg-surface/15 backdrop-blur-xl overflow-hidden flex flex-col min-h-0 ${isDragging ? "select-none cursor-col-resize" : ""
            }`}
        >
          {/* Console Header Bar */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface/50 backdrop-blur-md">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3">
                <h1 className="font-heading text-base font-bold text-text-primary tracking-tight shrink-0">
                  Advisor Workspace
                </h1>
                {/* Score Summary Bar */}
                <div className="hidden sm:block">
                  <ScoreSummaryBar dimensions={dossier} />
                </div>
              </div>
              <p className="hidden sm:block text-text-secondary text-[10.5px] mt-0.5 font-medium leading-none">
                Discuss your startup idea with the AI to compile your investment dossier. Drag the middle divider to resize columns.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {/* Tab Selector on mobile/tablet */}
              <div className="flex lg:hidden bg-text-secondary/5 rounded-xl p-0.5 border border-border relative">
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-200 relative z-10 ${activeTab === "chat"
                    ? "text-text-primary"
                    : "text-text-secondary hover:text-text-primary"
                    }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab("dossier")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-200 relative z-10 ${activeTab === "dossier"
                    ? "text-text-primary"
                    : "text-text-secondary hover:text-text-primary"
                    }`}
                >
                  Dossier {overallScore !== null ? `(${overallScore})` : ""}
                </button>
                {/* Sliding tab indicator */}
                <motion.div
                  className="absolute top-0.5 bottom-0.5 rounded-lg bg-surface shadow-sm"
                  layoutId="tab-indicator"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  style={{
                    left: activeTab === "chat" ? "2px" : "50%",
                    width: "calc(50% - 2px)",
                  }}
                />
              </div>

              {/* Export PDF Button */}
              {dossier.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.04, y: -1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleExportReport}
                  className="hidden sm:flex px-2.5 py-1.5 rounded-xl border border-border bg-surface text-[11px] font-bold text-text-secondary hover:border-accent/30 hover:bg-accent/5 hover:text-accent transition-all duration-200 cursor-pointer items-center space-x-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export Report</span>
                </motion.button>
              )}

              {/* History Button */}
              <motion.button
                whileHover={{ scale: 1.04, y: -1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowHistory(true)}
                className="hidden sm:flex px-2.5 py-1.5 rounded-xl border border-border bg-surface text-[11px] font-bold text-text-secondary hover:border-border-strong hover:text-text-primary transition-all duration-200 cursor-pointer items-center space-x-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>History</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.04, y: -1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleNewChat}
                className="px-3 py-1.5 rounded-xl border border-border bg-surface text-[11px] font-bold text-text-secondary hover:border-accent/30 hover:bg-accent/5 hover:text-accent transition-all duration-200 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              >
                New Chat
              </motion.button>
            </div>
          </div>

          {/* Console Body workspace area */}
          <div className="flex-grow flex overflow-hidden min-h-0 flex-col lg:flex-row items-stretch">
            {/* Left Column: Chat Interface */}
            <div
              className={`h-full flex flex-col border-r border-border min-h-0 bg-transparent ${activeTab === "chat" ? "flex" : "hidden lg:flex"
                }`}
              style={{ width: isDesktop ? `${leftWidth}%` : "100%" }}
            >
              <ChatInterface
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
              />
            </div>

            {/* Draggable Divider Line */}
            <div
              onMouseDown={handleMouseDown}
              className={`hidden lg:block w-1.5 hover:w-2 active:w-2 h-full bg-border hover:bg-accent/30 active:bg-accent cursor-col-resize transition-all duration-200 z-30 relative`}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-9 bg-surface border border-border rounded-full flex flex-col items-center justify-center space-y-0.5 shadow-md cursor-col-resize group active:bg-accent/5">
                <div className="w-0.5 h-3 bg-text-secondary/50 rounded-full" />
                <div className="w-0.5 h-3 bg-text-secondary/50 rounded-full" />
              </div>
            </div>

            {/* Right Column: Dossier Results */}
            <div
              className={`h-full overflow-y-auto min-h-0 bg-surface/5 custom-scrollbar p-6 ${activeTab === "dossier" ? "block" : "hidden lg:block"
                }`}
              style={{ width: isDesktop ? `${100 - leftWidth}%` : "100%" }}
            >
              <EvaluateResults dimensions={dossier} />
            </div>
          </div>
        </div>
      </div>
      <Disclaimer />

      {/* History Drawer */}
      <EvaluationHistory isOpen={showHistory} onClose={() => setShowHistory(false)} />

      {/* Report Preview Modal */}
      <AnimatePresence>
        {isReportModalOpen && (
          <ReportPreviewModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            viewMode={reportViewMode}
            setViewMode={setReportViewMode}
            dossier={dossier}
            messages={messages}
            overallScore={overallScore}
            onDownloadPdf={async () => {
              setIsExporting(true);
              const chartImg = await getRadarChartImage();
              buildPdf(chartImg);
              setIsExporting(false);
            }}
            isExporting={isExporting}
          />
        )}
      </AnimatePresence>
    </PageTransition>
  );
}

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode: "prompt" | "preview";
  setViewMode: (mode: "prompt" | "preview") => void;
  dossier: Dimension[];
  messages: { role: "user" | "assistant"; content: string }[];
  overallScore: number | null;
  onDownloadPdf: () => Promise<void>;
  isExporting: boolean;
}

function ReportPreviewModal({
  isOpen,
  onClose,
  viewMode,
  setViewMode,
  dossier,
  messages,
  overallScore,
  onDownloadPdf,
  isExporting,
}: ReportPreviewModalProps) {
  if (!isOpen) return null;

  const validDossier = dossier.filter((d) => d.score > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={`bg-surface border border-border rounded-2xl w-full flex flex-col shadow-2xl overflow-hidden transition-all duration-300 ${
          viewMode === "prompt" ? "max-w-md" : "max-w-4xl h-[85vh] md:h-[80vh]"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/50">
          <h2 className="font-heading text-sm font-bold text-text-primary tracking-tight">
            {viewMode === "prompt" ? "Report Compilation Complete" : "Startup Evaluation Report Preview"}
          </h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary text-xs font-semibold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        {viewMode === "prompt" ? (
          <div className="p-6 space-y-6">
            <p className="text-xs text-text-secondary leading-relaxed">
              Your startup evaluation report has been successfully compiled. You can preview the formatted layout or download the PDF document directly.
            </p>
            <div className="flex flex-col space-y-2.5">
              <button
                onClick={() => setViewMode("preview")}
                className="w-full py-2.5 rounded-xl bg-accent text-accent-inverse text-xs font-bold hover:bg-[#2b2b2b] transition-all duration-200 cursor-pointer shadow-sm text-center"
              >
                Show Report Preview
              </button>
              <button
                onClick={onDownloadPdf}
                disabled={isExporting}
                className="w-full py-2.5 rounded-xl border border-border bg-surface text-xs font-bold text-text-secondary hover:border-border-strong hover:text-text-primary transition-all duration-200 cursor-pointer text-center flex items-center justify-center space-x-1.5"
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-text-secondary" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Scrollable Report Preview */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-surface-hover/10 custom-scrollbar select-text">
              {/* Document Paper Sheet */}
              <div className="bg-surface border border-border shadow-lg rounded-2xl p-6 md:p-10 max-w-3xl mx-auto space-y-8">
                {/* Header info */}
                <div className="border-b border-border/60 pb-6 flex flex-col md:flex-row md:items-end justify-between space-y-4 md:space-y-0">
                  <div>
                    <h1 className="font-heading text-2xl font-bold text-text-primary tracking-tight">
                      Z-Combinators
                    </h1>
                    <p className="text-text-secondary text-sm font-semibold mt-1">
                      Startup Evaluation & Advisor Report
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <span className="text-[10px] text-text-tertiary font-bold tracking-wider uppercase">
                      Date Generated
                    </span>
                    <p className="text-xs text-text-secondary font-medium">
                      {new Date().toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Score and summary section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  <div className="flex items-center space-x-4 md:col-span-1">
                    {/* Ring score */}
                    <div className="w-16 h-16 rounded-full bg-accent/5 border border-accent/15 flex items-center justify-center shrink-0">
                      <span className="font-heading text-lg font-bold text-text-primary">
                        {overallScore !== null ? `${overallScore}/10` : "--"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-text-secondary tracking-wide uppercase">
                        Overall Score
                      </span>
                      <p className="text-[10px] text-text-tertiary font-semibold mt-0.5 leading-tight">
                        Based on {validDossier.length} scored dimensions
                      </p>
                    </div>
                  </div>
                  
                  {/* Radar chart preview copy */}
                  <div className="md:col-span-2 flex items-center justify-center bg-surface-hover/5 p-4 rounded-2xl border border-border/40 max-h-[220px] overflow-hidden">
                    <div className="scale-[0.8] origin-center w-full max-w-[200px]">
                      <RadarChart scores={
                        ["Market", "Team", "Timing", "Competition", "Moat", "Execution"].map((name) => {
                          const d = dossier.find((item) => item.dimension.toLowerCase() === name.toLowerCase());
                          return { dimension: name, score: d ? d.score : 0 };
                        })
                      } />
                    </div>
                  </div>
                </div>

                {/* Dimension Details list */}
                <div className="space-y-6 pt-4">
                  <h3 className="font-heading text-xs font-bold text-text-primary border-b border-border/40 pb-2 uppercase tracking-wider">
                    Dimension Evaluation Summary
                  </h3>
                  
                  <div className="space-y-5">
                    {dossier.map((d) => {
                      const isScored = d.score > 0;
                      return (
                        <div key={d.dimension} className="space-y-2 border-l-2 pl-4" style={{ borderColor: isScored ? "var(--color-border-strong)" : "var(--color-border)" }}>
                          <div className="flex items-center justify-between">
                            <h4 className="font-heading text-xs font-bold text-text-primary">
                              {d.dimension}
                            </h4>
                            <span className={`text-[10px] font-bold ${isScored ? "text-accent" : "text-text-tertiary"}`}>
                              {isScored ? `${d.score}/10` : "Pending Info (0/10)"}
                            </span>
                          </div>
                          
                          <p className="text-xs text-text-secondary leading-relaxed font-body">
                            {isScored ? d.justification : `No evaluation details available yet. Share more in chat.`}
                          </p>
                          
                          {isScored && d.source_framework && (
                            <span className="block text-[9px] text-text-tertiary italic font-medium pt-0.5">
                              Retrieved Framework Citation: {d.source_framework}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Chat Log details */}
                <div className="space-y-6 pt-4">
                  <h3 className="font-heading text-xs font-bold text-text-primary border-b border-border/40 pb-2 uppercase tracking-wider">
                    Advisor Chat Transcript Log
                  </h3>
                  <div className="space-y-4">
                    {messages.map((msg, idx) => (
                      <div key={idx} className="space-y-1">
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${
                          msg.role === "user" ? "text-accent" : "text-text-tertiary"
                        }`}>
                          {msg.role === "user" ? "YOU" : "ADVISOR"}
                        </span>
                        <p className="text-[11px] text-text-secondary leading-relaxed whitespace-pre-wrap pl-1 font-body">
                          {msg.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-border bg-surface/50 flex items-center justify-between">
              <button
                onClick={() => setReportViewMode("prompt")}
                className="px-4 py-2 rounded-xl border border-border hover:border-border-strong text-xs font-bold text-text-secondary hover:text-text-primary transition-all duration-200 cursor-pointer"
              >
                Back to Option
              </button>
              <button
                onClick={onDownloadPdf}
                disabled={isExporting}
                className="px-5 py-2 rounded-xl bg-accent text-accent-inverse text-xs font-bold hover:bg-[#2b2b2b] transition-all duration-200 cursor-pointer flex items-center space-x-1.5 shadow-sm"
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-accent-inverse" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function EvaluatePage() {
  return (
    <Suspense fallback={<div className="flex-grow flex items-center justify-center">Loading interface...</div>}>
      <EvaluateContent />
    </Suspense>
  );
}
