"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, useUser, UserButton } from "@clerk/nextjs";

export interface ServerSession {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  message_count: number;
  latest_score?: number | null;
}

interface WorkspaceSidebarProps {
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onToggle: () => void;
  refreshTrigger?: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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

function getScoreBadgeClass(score: number): string {
  if (score >= 8) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  if (score >= 5) return "bg-amber-500/10 text-amber-400 border-amber-500/30";
  return "bg-rose-500/10 text-rose-400 border-rose-500/30";
}

export default function WorkspaceSidebar({
  currentSessionId,
  onSelectSession,
  onNewChat,
  isOpen,
  onToggle,
  refreshTrigger = 0,
}: WorkspaceSidebarProps) {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [sessions, setSessions] = useState<ServerSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchSessions = useCallback(async () => {
    if (!isSignedIn) return;
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/v1/chat/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.warn("Failed to fetch sessions from server", err);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions, refreshTrigger]);

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
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          onNewChat();
        }
      }
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  };

  const filteredSessions = sessions.filter((s) =>
    (s.title || "Untitled Pitch").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-14 bottom-0 left-0 z-40 flex flex-col h-[calc(100dvh-56px)] bg-[#0d0e11] border-r border-zinc-800 transition-all duration-300 ease-in-out shrink-0 ${
          isOpen
            ? "w-[280px] sm:w-[300px] translate-x-0"
            : "-translate-x-full lg:translate-x-0 lg:w-0 lg:border-r-0 lg:overflow-hidden"
        }`}
      >
        {/* Top Header / Actions */}
        <div className="p-3.5 border-b border-zinc-800/80 flex flex-col gap-2.5 bg-[#111317]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="font-heading text-xs font-bold uppercase tracking-wider text-zinc-300">
                Pitch History
              </h2>
              {sessions.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-md bg-zinc-800 text-[10px] font-semibold text-zinc-400">
                  {sessions.length}
                </span>
              )}
            </div>

            {/* Toggle / Collapse Button */}
            <button
              onClick={onToggle}
              title="Collapse Sidebar"
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          {/* New Pitch Button */}
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-white text-black font-heading font-semibold text-xs hover:bg-zinc-200 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
          >
            <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>New Evaluation Pitch</span>
          </button>

          {/* Search box if there are 3+ sessions */}
          {sessions.length > 2 && (
            <div className="relative mt-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pitches..."
                className="w-full bg-[#181a20] border border-zinc-800 rounded-lg pl-7 pr-2.5 py-1 text-[11px] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition"
              />
              <svg
                className="w-3.5 h-3.5 text-zinc-500 absolute left-2 top-2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          )}
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-1.5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-40 space-y-2 text-zinc-500">
              <div className="w-5 h-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-[11px] font-medium">Loading saved pitches...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 text-center p-4 space-y-2 text-zinc-500">
              <div className="p-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-zinc-400">No pitches evaluated yet</p>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Describe your startup in the chat advisor to see your score dossier saved here.
              </p>
            </div>
          ) : (
            filteredSessions.map((s) => {
              const isActive = currentSessionId === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => onSelectSession(s.id)}
                  className={`group relative rounded-xl p-2.5 transition-all duration-200 cursor-pointer border ${
                    isActive
                      ? "bg-[#181a20] border-zinc-700 shadow-sm"
                      : "bg-[#121418] hover:bg-[#16181e] border-zinc-800/80 hover:border-zinc-700/80"
                  }`}
                >
                  {/* Active Indicator Left Pill */}
                  {isActive && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full" />
                  )}

                  <div className="flex items-start justify-between gap-1.5 pl-1">
                    <h3
                      className={`text-xs font-medium line-clamp-1 flex-1 pr-1 ${
                        isActive ? "text-white font-semibold" : "text-zinc-300 group-hover:text-white"
                      }`}
                    >
                      {s.title || "Untitled Pitch"}
                    </h3>

                    {/* Overall Score Badge */}
                    {s.latest_score !== null && s.latest_score !== undefined && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${getScoreBadgeClass(
                          s.latest_score
                        )}`}
                      >
                        {s.latest_score.toFixed(1)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-2 pt-1.5 border-t border-zinc-800/50 pl-1">
                    <span>
                      {s.message_count} msg{s.message_count === 1 ? "" : "s"} • {formatDate(s.updated_at || s.created_at)}
                    </span>

                    {/* Delete Session Button */}
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      title="Delete pitch evaluation"
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 transition cursor-pointer text-zinc-500"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-zinc-800/90 bg-[#111317]">
          {isSignedIn && user ? (
            <div className="flex items-center justify-between p-1.5 rounded-xl bg-[#16181f] border border-zinc-800/80">
              <div className="flex items-center space-x-2.5 min-w-0">
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8 rounded-full border border-zinc-700",
                    },
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate leading-tight">
                    {user.fullName || user.firstName || user.username || "Founder"}
                  </p>
                  <p className="text-[10px] text-zinc-400 truncate leading-tight mt-0.5">
                    {user.primaryEmailAddress?.emailAddress || "Verified"}
                  </p>
                </div>
              </div>

              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/60 shrink-0">
                Pro
              </span>
            </div>
          ) : (
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-center text-xs text-zinc-400">
              Not Signed In
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
