"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  if (score >= 8) return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (score >= 5) return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-rose-50 text-rose-800 border-rose-200";
}

/**
 * ChatGPT-style sidebar toggle icon (window with left sidebar divider and direction arrow)
 */
export function SidebarToggleIcon({
  isOpen,
  className = "w-4 h-4",
}: {
  isOpen?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      {isOpen ? (
        <path d="M15 9l-3 3 3 3" />
      ) : (
        <path d="M13 15l3-3-3-3" />
      )}
    </svg>
  );
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
  const [sortBy, setSortBy] = useState<"recent" | "score">("recent");

  // Inline title editing state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Deletion confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar, Escape to collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        onToggle();
      }
      if (e.key === "Escape" && isOpen) {
        onToggle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggle, isOpen]);

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

  // Focus input when editing starts
  useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSessionId]);

  const handleStartRename = (sessionId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(sessionId);
    setEditTitleValue(currentTitle);
  };

  const handleSaveRename = async (sessionId: string) => {
    const trimmed = editTitleValue.trim();
    if (!trimmed) {
      setEditingSessionId(null);
      return;
    }

    try {
      const token = await getToken();
      if (token) {
        await fetch(`${API_URL}/api/v1/chat/session/${sessionId}/title`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title: trimmed }),
        });
      }
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: trimmed } : s))
      );
    } catch (err) {
      console.error("Failed to rename session", err);
    } finally {
      setEditingSessionId(null);
    }
  };

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
    } finally {
      setConfirmDeleteId(null);
    }
  };

  // Filter out blank sessions with 0 messages
  const filteredSessions = sessions
    .filter((s) => (s.message_count || 0) > 0)
    .filter((s) =>
      (s.title || "Untitled Pitch").toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "score") {
        return (b.latest_score || 0) - (a.latest_score || 0);
      }
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    });

  // Reusable expanded sidebar content
  const renderExpandedContent = (isMobileDrawer = false) => (
    <div className="flex flex-col h-full w-full select-none">
      {/* Header Actions */}
      <div className="p-3 border-b border-black/8 flex flex-col gap-2.5 bg-[#F4F3EE]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="font-heading text-xs font-bold uppercase tracking-wider text-neutral-800">
              Pitch History
            </h2>
            {filteredSessions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-md bg-white border border-black/10 text-[10px] font-bold text-neutral-700">
                {filteredSessions.length}
              </span>
            )}
          </div>

          {/* Toggle / Collapse Button */}
          <button
            onClick={onToggle}
            title={isMobileDrawer ? "Close History (Esc)" : "Collapse sidebar (Ctrl+B)"}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-black hover:bg-black/5 transition cursor-pointer"
          >
            {isMobileDrawer ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <SidebarToggleIcon isOpen={true} className="w-4 h-4 text-neutral-700" />
            )}
          </button>
        </div>

        {/* New Pitch CTA Button */}
        <button
          onClick={() => {
            onNewChat();
            if (isMobileDrawer) onToggle();
          }}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-[#0A0A0A] text-white font-heading font-bold text-xs hover:bg-neutral-800 active:scale-[0.98] transition cursor-pointer shadow-xs"
        >
          <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span>New Evaluation Pitch</span>
        </button>

        {/* Search & Sort Controls */}
        {filteredSessions.length > 1 && (
          <div className="space-y-1.5 pt-0.5">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pitches..."
                className="w-full bg-white border border-black/12 rounded-lg pl-7 pr-2.5 py-1 text-[11px] text-black placeholder-neutral-400 focus:outline-none focus:border-black/40 transition font-medium"
              />
              <svg
                className="w-3.5 h-3.5 text-neutral-400 absolute left-2 top-1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Sort selector */}
            <div className="flex items-center justify-between text-[10px] text-neutral-500 px-0.5 pt-0.5">
              <span>Sort by:</span>
              <div className="flex items-center space-x-2 font-medium">
                <button
                  onClick={() => setSortBy("recent")}
                  className={`cursor-pointer transition ${
                    sortBy === "recent" ? "text-black font-bold" : "hover:text-black"
                  }`}
                >
                  Recent
                </button>
                <span>•</span>
                <button
                  onClick={() => setSortBy("score")}
                  className={`cursor-pointer transition ${
                    sortBy === "score" ? "text-black font-bold" : "hover:text-black"
                  }`}
                >
                  Top Score
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40 space-y-2 text-neutral-400">
            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            <p className="text-[11px] font-medium text-neutral-600">Loading saved pitches...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-4 space-y-2.5 text-neutral-400">
            <div className="p-3 rounded-full bg-white border border-black/8 text-neutral-600 shadow-xs">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-neutral-700">
              {searchQuery ? "No matching pitches found" : "No pitch evaluations yet"}
            </p>
            <p className="text-[11px] text-neutral-500 leading-relaxed max-w-[200px]">
              {searchQuery
                ? "Try a different search term"
                : "Chat with the advisor to evaluate your idea and see your dossier here."}
            </p>
          </div>
        ) : (
          filteredSessions.map((s) => {
            const isActive = currentSessionId === s.id;
            const isEditing = editingSessionId === s.id;
            const isDeleting = confirmDeleteId === s.id;

            return (
              <div
                key={s.id}
                onClick={() => {
                  if (!isEditing) {
                    onSelectSession(s.id);
                    if (isMobileDrawer) onToggle();
                  }
                }}
                className={`group relative rounded-xl p-2.5 transition-all duration-200 cursor-pointer border ${
                  isActive
                    ? "bg-white border-black/20 shadow-xs"
                    : "bg-transparent hover:bg-white/80 border-transparent hover:border-black/8"
                }`}
              >
                {/* Active Indicator Left Pill */}
                {isActive && (
                  <div className="absolute left-0 top-2 bottom-2 w-1 bg-[#0A0A0A] rounded-r-full" />
                )}

                <div className="flex items-start justify-between gap-1.5 pl-1">
                  {/* Title or Edit Input */}
                  {isEditing ? (
                    <div className="flex-1 mr-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editTitleValue}
                        onChange={(e) => setEditTitleValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRename(s.id);
                          if (e.key === "Escape") setEditingSessionId(null);
                        }}
                        onBlur={() => handleSaveRename(s.id)}
                        className="w-full bg-white border border-black/30 rounded px-1.5 py-0.5 text-xs text-black focus:outline-none"
                      />
                    </div>
                  ) : (
                    <h3
                      className={`text-xs font-medium line-clamp-1 flex-1 pr-1 ${
                        isActive ? "text-[#0A0A0A] font-bold" : "text-neutral-700 group-hover:text-black"
                      }`}
                      title={s.title || "Untitled Pitch"}
                    >
                      {s.title || "Untitled Pitch"}
                    </h3>
                  )}

                  {/* Overall Score Badge */}
                  {s.latest_score !== null && s.latest_score !== undefined && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${getScoreBadgeClass(
                        s.latest_score
                      )}`}
                    >
                      {s.latest_score.toFixed(1)}
                    </span>
                  )}
                </div>

                {/* Metadata & Actions row */}
                <div className="flex items-center justify-between text-[10px] text-neutral-500 mt-1.5 pt-1.5 border-t border-black/5 pl-1 font-medium">
                  <span>
                    {s.message_count} turn{s.message_count === 1 ? "" : "s"} • {formatDate(s.updated_at || s.created_at)}
                  </span>

                  {/* Action buttons (Rename & Delete) */}
                  <div className="flex items-center space-x-1.5">
                    {isDeleting ? (
                      <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[9px] text-rose-600 font-bold">Delete?</span>
                        <button
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 hover:bg-rose-200 text-[9px] font-bold transition cursor-pointer"
                        >
                          Yes
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className="px-1 py-0.5 rounded text-neutral-500 hover:text-black text-[9px] transition cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Rename Button */}
                        <button
                          onClick={(e) => handleStartRename(s.id, s.title || "Untitled Pitch", e)}
                          title="Rename pitch"
                          className="opacity-0 group-hover:opacity-100 hover:text-black p-0.5 transition cursor-pointer text-neutral-400"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(s.id);
                          }}
                          title="Delete pitch evaluation"
                          className="opacity-0 group-hover:opacity-100 hover:text-rose-600 p-0.5 transition cursor-pointer text-neutral-400"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-black/8 bg-[#F4F3EE]">
        {isSignedIn && user ? (
          <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-black/10 shadow-xs">
            <div className="flex items-center space-x-2.5 min-w-0">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8 rounded-full border border-black/10",
                  },
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#0A0A0A] truncate leading-tight">
                  {user.fullName || user.firstName || user.username || "Founder"}
                </p>
                <p className="text-[10px] text-neutral-500 truncate leading-tight mt-0.5">
                  {user.primaryEmailAddress?.emailAddress || "Verified"}
                </p>
              </div>
            </div>

            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-200 shrink-0">
              Pro
            </span>
          </div>
        ) : (
          <div className="p-2 rounded-xl bg-white border border-black/10 text-center text-xs text-neutral-500">
            Not Signed In
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 1. DESKTOP SIDEBAR: Persistent narrow bar (w-14) that smoothly slides open to (w-[270px]) like ChatGPT */}
      <aside
        className={`hidden md:flex flex-col h-full bg-[#FAF9F5] border-r border-black/8 select-none transition-all duration-300 ease-in-out shrink-0 overflow-hidden relative ${
          isOpen ? "w-[270px]" : "w-14"
        }`}
      >
        {isOpen ? (
          <div className="w-[270px] h-full flex flex-col shrink-0">
            {renderExpandedContent(false)}
          </div>
        ) : (
          /* Collapsed Small Bar (Icon Strip) */
          <div className="w-14 h-full flex flex-col items-center justify-between py-3 shrink-0 bg-[#FAF9F5]">
            {/* Top Icons */}
            <div className="flex flex-col items-center space-y-3 w-full">
              {/* Toggle / Expand Icon */}
              <button
                onClick={onToggle}
                title="Expand sidebar (Ctrl+B)"
                className="w-10 h-10 rounded-xl flex items-center justify-center text-neutral-600 hover:text-black hover:bg-black/5 active:bg-black/10 transition cursor-pointer"
              >
                <SidebarToggleIcon isOpen={false} className="w-4 h-4 text-neutral-700" />
              </button>

              <div className="w-8 h-px bg-black/8" />

              {/* New Pitch Icon Button */}
              <button
                onClick={onNewChat}
                title="New Evaluation Pitch"
                className="w-10 h-10 rounded-xl flex items-center justify-center text-neutral-700 hover:text-black hover:bg-black/5 active:bg-black/10 transition cursor-pointer"
              >
                <svg className="w-4 h-4 stroke-[2.2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>

              {/* Saved Pitches History Icon Button */}
              <button
                onClick={onToggle}
                title={`Pitch History (${filteredSessions.length})`}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-neutral-700 hover:text-black hover:bg-black/5 active:bg-black/10 transition cursor-pointer relative"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {filteredSessions.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[#FAF9F5]" />
                )}
              </button>
            </div>

            {/* Bottom Profile Avatar */}
            <div className="flex items-center justify-center pb-1" title={user?.fullName || "Account"}>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8 rounded-full border border-black/10 hover:ring-2 hover:ring-black/20 transition",
                  },
                }}
              />
            </div>
          </div>
        )}
      </aside>

      {/* 2. MOBILE DRAWER: Slide-over overlay on small screens (< 768px) */}
      <AnimatePresence>
        {isOpen && (
          <div className="md:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onToggle}
              className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 cursor-pointer"
            />

            {/* Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
              className="fixed top-0 bottom-0 left-0 z-50 w-[285px] sm:w-[320px] flex flex-col h-full bg-[#FAF9F5] border-r border-black/10 shadow-2xl select-none"
            >
              {renderExpandedContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
