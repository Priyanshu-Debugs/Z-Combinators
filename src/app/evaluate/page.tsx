"use client";

import { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PageTransition from "../components/PageTransition";
import ChatInterface from "../components/ChatInterface";
import EvaluateResults from "../components/EvaluateResults";
import Disclaimer from "../components/Disclaimer";
import ScoreSummaryBar from "../components/ScoreSummaryBar";
import EvaluationHistory, { saveEvaluation } from "../components/EvaluationHistory";

interface Dimension {
  dimension: string;
  score: number;
  justification: string;
  source_excerpt: string;
  source_framework: string;
  confidence: "high" | "medium" | "low";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const WELCOME_MESSAGE = {
  role: "assistant" as const,
  content:
    "Hi! I'm your Startup Advisor. To help me evaluate your startup idea with the best results, tell me about:\n\n" +
    "1. **Market**: Who is your customer base and what is the market size?\n" +
    "2. **Team**: Who is on the founding team and what is their domain expertise?\n" +
    "3. **Timing**: Why is now the right time to build this? Any macro trends or tech shifts?\n" +
    "4. **Competition**: Who are your main competitors and how do you differentiate?\n" +
    "5. **Moat**: What is your unfair advantage, defensibility, or network effects?\n" +
    "6. **Execution**: What is your go-to-market plan, pricing, and distribution model?\n\n" +
    "You can describe your startup idea in a few sentences, or answer any of these specific dimensions to start!",
};

function EvaluateContent() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    WELCOME_MESSAGE,
  ]);
  const [dossier, setDossier] = useState<Dimension[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "dossier">("chat");
  const [showHistory, setShowHistory] = useState(false);
  const [copyToast, setCopyToast] = useState(false);

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
    const cachedSessionId = localStorage.getItem("z_combinator_session_id");

    if (cachedSessionId) {
      try {
        const res = await fetch(`${API_URL}/api/chat/session/${cachedSessionId}`);
        if (res.ok) {
          const data = await res.json();
          setSessionId(data.session_id);
          setMessages(data.history.length > 0 ? data.history : [WELCOME_MESSAGE]);
          setDossier(data.compiled_dossier);
          setError(null);
          setIsInitializing(false);
          if (retryTimerRef.current) {
            clearInterval(retryTimerRef.current);
            retryTimerRef.current = null;
          }
          return true;
        }
      } catch (err) {
        console.warn("Failed to restore cached session, creating new session...", err);
      }
    }

    try {
      const res = await fetch(`${API_URL}/api/chat/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.session_id);
        localStorage.setItem("z_combinator_session_id", data.session_id);
        setMessages([WELCOME_MESSAGE]);
        setDossier([]);
        setError(null);
        setIsInitializing(false);
        if (retryTimerRef.current) {
          clearInterval(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        return true;
      }
    } catch (err) {
      setError(
        "Advisor service is currently booting up (typical for free hosting, takes 1-2 minutes). We are retrying connection automatically..."
      );
    }
    setIsInitializing(false);
    return false;
  }, []);

  // Poll for connection if it fails
  useEffect(() => {
    initSession();

    // Set up background retry interval
    retryTimerRef.current = setInterval(async () => {
      const success = await initSession();
      if (success && retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    }, 6000);

    return () => {
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [initSession]);

  // Save evaluation to history when dimensions change significantly
  useEffect(() => {
    if (dossier.length >= 3 && messages.length > 0) {
      const firstUserMsg = messages.find((m) => m.role === "user");
      if (firstUserMsg) {
        const overallScore = Math.round(
          (dossier.reduce((acc, d) => acc + d.score, 0) / dossier.length) * 10
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
      const res = await fetch(`${API_URL}/api/chat/message`, {
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

      const data = await res.json();

      setMessages([...updatedMessages, { role: "assistant" as const, content: data.reply }]);
      setDossier(data.compiled_dossier);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setMessages([
        ...updatedMessages,
        {
          role: "assistant" as const,
          content: "I ran into a server error processing your message. Please check that the API is running and try again."
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSession = async () => {
    setIsInitializing(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/chat/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.session_id);
        localStorage.setItem("z_combinator_session_id", data.session_id);
        setMessages([WELCOME_MESSAGE]);
        setDossier([]);
      }
    } catch (err) {
      setError("Failed to reset session.");
    } finally {
      setIsInitializing(false);
    }
  };

  const handleCopyResults = () => {
    if (dossier.length === 0) return;

    const overallScore = Math.round(
      (dossier.reduce((acc, d) => acc + d.score, 0) / dossier.length) * 10
    ) / 10;

    const dimScores = dossier
      .map((d) => `${d.dimension}: ${d.score}/10`)
      .join(" | ");

    const text = `Z-Combinator Evaluation: ${overallScore}/10\n${dimScores}\n\nEvaluate your startup idea at z-combinator.com`;

    navigator.clipboard.writeText(text).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    });
  };

  if (isInitializing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-text-secondary text-sm font-medium">
        <div className="flex flex-col items-center space-y-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 rounded-full border-4 border-t-accent border-r-transparent border-b-accent border-l-transparent"
          />
          <span>Restoring Advisor Workspace...</span>
        </div>
      </div>
    );
  }

  // Compute overallScore for tab badge
  const scoredMap = new Map<string, Dimension>();
  dossier.forEach((d) => {
    scoredMap.set(d.dimension.toLowerCase(), d);
  });
  const ALL_DIMENSIONS = ["Market", "Team", "Timing", "Competition", "Moat", "Execution"];
  const scoredDimensions = ALL_DIMENSIONS.map((name) =>
    scoredMap.get(name.toLowerCase())
  ).filter(Boolean) as Dimension[];

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
      <div className="flex-grow flex flex-col pt-14 pb-0 px-0 mx-0 w-full max-w-full h-[calc(100vh-92px)] min-h-[550px] overflow-hidden">
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

              {/* Copy Results Button */}
              {dossier.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={handleCopyResults}
                  className="hidden sm:flex px-2.5 py-1.5 rounded-xl border border-border bg-surface text-[11px] font-bold text-text-secondary hover:border-accent/30 hover:bg-accent/5 hover:text-accent transition-all duration-200 cursor-pointer items-center space-x-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Copy</span>
                </motion.button>
              )}

              {/* History Button */}
              <button
                onClick={() => setShowHistory(true)}
                className="hidden sm:flex px-2.5 py-1.5 rounded-xl border border-border bg-surface text-[11px] font-bold text-text-secondary hover:border-border-strong hover:text-text-primary transition-all duration-200 cursor-pointer items-center space-x-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>History</span>
              </button>

              <button
                onClick={handleResetSession}
                className="px-3 py-1.5 rounded-xl border border-border bg-surface text-[11px] font-bold text-text-secondary hover:border-score-low/30 hover:bg-score-low/5 hover:text-score-low transition-all duration-200 cursor-pointer active:scale-95 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              >
                Reset Chat
              </button>
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

      {/* Copy Toast */}
      <AnimatePresence>
        {copyToast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-accent text-accent-inverse px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center space-x-2"
          >
            <svg className="w-3.5 h-3.5 text-score-high" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>Results copied to clipboard</span>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}

export default function EvaluatePage() {
  return (
    <Suspense fallback={<div className="flex-grow flex items-center justify-center">Loading interface...</div>}>
      <EvaluateContent />
    </Suspense>
  );
}
