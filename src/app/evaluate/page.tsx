"use client";

import { useState, useEffect, Suspense } from "react";
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
        setError("Could not connect to the startup advisor server. Please check your connection.");
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

  return (
    <PageTransition>
      <div className="flex-1 flex flex-col justify-between pt-24 md:pt-28 pb-16 px-4 sm:px-6 md:px-8 lg:px-12 max-w-6xl mx-auto w-full">
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-score-low/30 bg-score-low/5 text-score-low text-xs flex items-center justify-between">
            <span>{error}</span>
            <button 
              onClick={() => setError(null)} 
              className="text-score-low font-bold hover:opacity-80 ml-2"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start w-full">
          {/* Left Panel: Chat Interface */}
          <div className="lg:col-span-6 w-full flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-1">
              <div>
                <h1 className="font-heading text-2xl font-bold text-text-primary tracking-tight">
                  Advisor Workspace
                </h1>
                <p className="text-text-secondary text-xs mt-0.5">
                  Discuss your idea to compile the investment dossier report.
                </p>
              </div>
              <button
                onClick={handleResetSession}
                className="px-3.5 py-1.5 rounded-full border border-border bg-surface/50 text-[10px] text-text-secondary hover:border-score-low/30 hover:bg-score-low/5 hover:text-score-low transition-all duration-200 cursor-pointer active:scale-95"
              >
                Reset Chat
              </button>
            </div>
            
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
            />
          </div>

          {/* Right Panel: Sticky Evaluations Dashboard */}
          <div className="lg:col-span-6 w-full lg:sticky lg:top-24">
            <EvaluateResults dimensions={dossier} />
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
