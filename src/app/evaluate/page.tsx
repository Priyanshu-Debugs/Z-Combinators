"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import PageTransition from "../components/PageTransition";
import ChatInterface from "../components/ChatInterface";
import EvaluateResults from "../components/EvaluateResults";
import Disclaimer from "../components/Disclaimer";

interface Dimension {
  dimension: string;
  score: number;
  justification: string;
  source_excerpt: string;
  source_framework: string;
  confidence: "high" | "medium" | "low";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function EvaluateContent() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [dossier, setDossier] = useState<Dimension[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "dossier">("chat");

  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(50); // initial split 50/50
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
      // Constrain between 25% and 75%
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

  // Initialize session on mount
  useEffect(() => {
    async function initSession() {
      setError(null);
      const cachedSessionId = localStorage.getItem("z_combinator_session_id");

      if (cachedSessionId) {
        try {
          const res = await fetch(`${API_URL}/api/chat/session/${cachedSessionId}`);
          if (res.ok) {
            const data = await res.json();
            setSessionId(data.session_id);
            setMessages(data.history);
            setDossier(data.compiled_dossier);
            setIsInitializing(false);
            return;
          }
        } catch (err) {
          console.warn("Failed to restore cached session, creating new session...", err);
        }
      }

      // Create a fresh session if no cache exists or restoring failed
      try {
        const res = await fetch(`${API_URL}/api/chat/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error("Could not initialize session.");
        
        const data = await res.json();
        setSessionId(data.session_id);
        localStorage.setItem("z_combinator_session_id", data.session_id);
        setMessages([]);
        setDossier([]);
      } catch (err) {
        setError(
          "Could not connect to the startup advisor server. " +
          "Note: Render free tier databases and servers spin down after 15m of inactivity and can take 1-2 minutes to wake up. " +
          "If this persists, verify you have added NEXT_PUBLIC_API_URL=https://z-combinator-backend.onrender.com to your Vercel Project Environment Variables, and set CORS_ORIGINS=https://z-combinators.vercel.app in your Render settings."
        );
      } finally {
        setIsInitializing(false);
      }
    }

    initSession();
  }, []);

  const handleSendMessage = async (content: string) => {
    if (!sessionId) return;
    
    setIsLoading(true);
    setError(null);
    
    // 1. Instantly append user's message to chat UI
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
      
      // 2. Append assistant's reply and update scores dossier
      setMessages([...updatedMessages, { role: "assistant" as const, content: data.reply }]);
      setDossier(data.compiled_dossier);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      // Keep chat interactive by dropping user back, but notify them
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
        setMessages([]);
        setDossier([]);
      }
    } catch (err) {
      setError("Failed to reset session.");
    } finally {
      setIsInitializing(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-text-secondary text-sm font-medium">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 rounded-full border-4 border-t-accent border-r-transparent border-b-accent border-l-transparent animate-spin" />
          <span>Restoring Advisor Workspace...</span>
        </div>
      </div>
    );
  }

  // Map dimensions list by name for quick lookup to compute overallScore for tab badge
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
        {error && (
          <div className="flex-shrink-0 mx-6 mt-4 p-4 rounded-xl border border-score-low/30 bg-score-low/5 text-score-low text-xs flex items-center justify-between">
            <span>{error}</span>
            <button 
              onClick={() => setError(null)} 
              className="text-score-low font-bold hover:opacity-80 ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Master Workspace Console Box */}
        <div 
          ref={containerRef}
          className={`flex-grow w-full border-t border-b border-border bg-surface/15 backdrop-blur-xl overflow-hidden flex flex-col min-h-0 ${
            isDragging ? "select-none cursor-col-resize" : ""
          }`}
        >
          {/* Console Header Bar */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface/50 backdrop-blur-md">
            <div>
              <h1 className="font-heading text-base font-bold text-text-primary tracking-tight">
                Advisor Workspace
              </h1>
              <p className="hidden sm:block text-text-secondary text-[10.5px] mt-0.5 font-medium leading-none">
                Discuss your startup idea with the AI to compile your investment dossier. Drag the middle divider to resize columns.
              </p>
            </div>
            
            <div className="flex items-center space-x-2.5">
              {/* Tab Selector on mobile/tablet */}
              <div className="flex lg:hidden bg-text-secondary/5 rounded-xl p-0.5 border border-border">
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-200 ${
                    activeTab === "chat"
                      ? "bg-surface text-text-primary shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab("dossier")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-200 ${
                    activeTab === "dossier"
                      ? "bg-surface text-text-primary shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Dossier {overallScore !== null ? `(${overallScore})` : ""}
                </button>
              </div>

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
              className={`h-full flex flex-col border-r border-border min-h-0 bg-transparent ${
                activeTab === "chat" ? "flex" : "hidden lg:flex"
              }`}
              style={{ width: isDesktop ? `${leftWidth}%` : "100%" }}
            >
              <ChatInterface
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
              />
            </div>

            {/* Draggable Divider Line (NotebookLM style) */}
            <div
              onMouseDown={handleMouseDown}
              className={`hidden lg:block w-1.5 hover:w-2 active:w-2 h-full bg-border hover:bg-accent/40 active:bg-accent cursor-col-resize transition-all duration-200 z-30 relative`}
            >
              {/* Drag handle button */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-9 bg-surface border border-border rounded-full flex flex-col items-center justify-center space-y-0.5 shadow-md cursor-col-resize group active:bg-accent/5">
                <div className="w-0.5 h-3 bg-text-secondary/50 rounded-full" />
                <div className="w-0.5 h-3 bg-text-secondary/50 rounded-full" />
              </div>
            </div>

            {/* Right Column: Dossier Results (internally scrollable) */}
            <div
              className={`h-full overflow-y-auto min-h-0 bg-surface/5 custom-scrollbar p-6 ${
                activeTab === "dossier" ? "block" : "hidden lg:block"
              }`}
              style={{ width: isDesktop ? `${100 - leftWidth}%` : "100%" }}
            >
              <EvaluateResults dimensions={dossier} />
            </div>
          </div>
        </div>
      </div>
      <Disclaimer />
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
