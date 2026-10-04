"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  evaluations?: unknown;
  timestamp?: number;
  suggested_followups?: string[];
  wasStreamed?: boolean;
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
}

function getRelativeTime(timestamp?: number): string {
  if (!timestamp) return "";
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ===== Code Block with Dark Syntax Header ===== */
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="my-3 rounded-xl border border-neutral-800 bg-[#111215] overflow-hidden text-xs font-mono shadow-sm">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#18191f] border-b border-neutral-800 text-neutral-400 select-none">
        <span className="font-semibold text-[11px] uppercase tracking-wider">{language || "Code"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 text-neutral-300 hover:text-white transition px-2 py-0.5 rounded hover:bg-neutral-800 cursor-pointer"
        >
          {copied ? (
            <>
              <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-emerald-400 text-[10px] font-bold">Copied</span>
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-[10px]">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto custom-scrollbar text-neutral-100 leading-relaxed whitespace-pre font-mono">
        {code}
      </pre>
    </div>
  );
}

/* ===== Inline text parser (bold, inline code) ===== */
function parseInlineFormatting(text: string) {
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
        <strong key={idx} className="font-bold text-[#0A0A0A] tracking-normal">
          {boldText}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      const codeText = token.slice(1, -1);
      parts.push(
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200/80 text-neutral-900 font-mono text-[11px] font-semibold tracking-tight mx-0.5 select-all"
        >
          {codeText}
        </code>
      );
    } else {
      parts.push(token);
    }
  });

  return parts;
}

/* ===== Markdown Parser with Framework Citations, Headings, Lists, Blockquotes ===== */
function renderMarkdownContent(text: string, isStreaming: boolean = false) {
  // Check for code blocks
  if (text.includes("```")) {
    const segments = text.split(/(```[\s\S]*?```)/g);
    return segments.map((seg, sIdx) => {
      if (seg.startsWith("```") && seg.endsWith("```")) {
        const withoutBackticks = seg.slice(3, -3);
        const firstLineEnd = withoutBackticks.indexOf("\n");
        let lang = "code";
        let code = withoutBackticks;
        if (firstLineEnd !== -1) {
          lang = withoutBackticks.slice(0, firstLineEnd).trim();
          code = withoutBackticks.slice(firstLineEnd + 1);
        }
        return <CodeBlock key={sIdx} code={code.trim()} language={lang} />;
      }
      return <div key={sIdx}>{renderMarkdownContent(seg, false)}</div>;
    });
  }

  const paragraphs = text.split("\n\n");

  return (
    <>
      {paragraphs.map((para, pIdx) => {
        const cleanPara = para.trim();
        if (!cleanPara) return null;

        // Framework Citation callouts
        if (
          cleanPara.toLowerCase().startsWith("framework citation:") ||
          cleanPara.toLowerCase().startsWith("source framework:") ||
          cleanPara.toLowerCase().startsWith("[source:")
        ) {
          return (
            <div
              key={pIdx}
              className="my-3 px-4 py-3 rounded-xl bg-[#F6F6F4] border border-black/10 flex items-start space-x-3 shadow-xs text-xs"
            >
              <span className="text-base select-none shrink-0 mt-0.5">📚</span>
              <div className="flex-1 space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 block">
                  Institutional Framework Grounding
                </span>
                <p className="text-neutral-900 font-medium italic leading-relaxed">
                  {parseInlineFormatting(cleanPara)}
                </p>
              </div>
            </div>
          );
        }

        // Headings
        if (cleanPara.startsWith("### ")) {
          return (
            <h3 key={pIdx} className="font-heading text-sm font-bold text-[#0A0A0A] tracking-tight mt-4 mb-2 first:mt-1">
              {parseInlineFormatting(cleanPara.slice(4))}
            </h3>
          );
        }
        if (cleanPara.startsWith("## ")) {
          return (
            <h2 key={pIdx} className="font-heading text-base font-bold text-[#0A0A0A] tracking-tight mt-5 mb-2.5 first:mt-1 border-b border-black/10 pb-1">
              {parseInlineFormatting(cleanPara.slice(3))}
            </h2>
          );
        }
        if (cleanPara.startsWith("# ")) {
          return (
            <h1 key={pIdx} className="font-heading text-lg font-bold text-[#0A0A0A] tracking-tight mt-6 mb-3 first:mt-1">
              {parseInlineFormatting(cleanPara.slice(2))}
            </h1>
          );
        }

        // Blockquotes
        if (cleanPara.startsWith("> ")) {
          return (
            <blockquote
              key={pIdx}
              className="border-l-2 border-[#0A0A0A] pl-4 py-1.5 italic text-neutral-700 my-3 bg-black/[0.02] rounded-r-lg"
            >
              {parseInlineFormatting(cleanPara.slice(2))}
            </blockquote>
          );
        }

        // Horizontal Rule
        if (cleanPara === "---" || cleanPara === "***") {
          return <hr key={pIdx} className="border-black/10 my-4" />;
        }

        // Lists (numbered or bulleted)
        const lines = para.split("\n");
        const isList = lines.some((line) =>
          line.trim().startsWith("•") ||
          line.trim().startsWith("*") ||
          line.trim().startsWith("-") ||
          /^\d+\.\s/.test(line.trim())
        );

        if (isList) {
          return (
            <div key={pIdx} className="space-y-1.5 my-2.5 pl-1">
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

                const parsed = parseInlineFormatting(content);

                if (isBullet) {
                  return (
                    <div key={lIdx} className="flex items-start space-x-2.5 pl-3">
                      <span className="text-neutral-400 select-none font-bold text-xs mt-1 shrink-0">•</span>
                      <span className="text-neutral-800 text-sm leading-relaxed flex-1 font-body font-medium">{parsed}</span>
                    </div>
                  );
                }
                if (isNumbered) {
                  return (
                    <div key={lIdx} className="flex items-start space-x-2 pl-2">
                      <span className="text-[#0A0A0A] font-bold text-xs select-none mt-1 shrink-0">{bulletNum}.</span>
                      <span className="text-neutral-800 text-sm leading-relaxed flex-1 font-body font-medium">{parsed}</span>
                    </div>
                  );
                }
                return (
                  <p key={lIdx} className="text-neutral-800 text-sm leading-relaxed font-body font-medium pl-1">
                    {parsed}
                  </p>
                );
              })}
            </div>
          );
        }

        // Standard paragraph
        return (
          <p key={pIdx} className="text-neutral-900 text-sm leading-relaxed font-body font-medium my-2.5 first:mt-0 last:mb-0">
            {parseInlineFormatting(para)}
          </p>
        );
      })}

      {/* Pulsing Streaming Cursor */}
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-black ml-1 translate-y-0.5 animate-pulse rounded-xs" />
      )}
    </>
  );
}

const messageVariants = {
  hidden: (isUser: boolean) => ({
    opacity: 0,
    x: isUser ? 16 : -16,
    scale: 0.98,
  }),
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut" as const,
    },
  },
};

const SUGGESTED_STARTER_PROMPTS = [
  "Evaluate my B2B SaaS startup idea",
  "Analyze our moat, defensibility, and network effects",
  "How should I address competition from incumbents?",
  "What is my TAM and target customer persona?",
];

export default function ChatInterface({
  messages,
  onSendMessage,
  isLoading,
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [ratings, setRatings] = useState<Record<number, "like" | "dislike">>({});
  const isUserScrollingRef = useRef(false);

  // Global keyboard shortcut to focus input: Cmd/Ctrl + /
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, []);

  // Intelligent auto-scroll
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isAwayFromBottom = distanceFromBottom > 160;
      isUserScrollingRef.current = isAwayFromBottom;
      setShowScrollBottom(isAwayFromBottom);
    }
  }, []);

  const scrollToBottom = () => {
    isUserScrollingRef.current = false;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    onSendMessage(inputValue.trim());
    setInputValue("");
    isUserScrollingRef.current = false;

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

  const handleCopyMessage = (content: string, index: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const handleEditUserMessage = (content: string) => {
    setInputValue(content);
    inputRef.current?.focus();
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 180)}px`;
    }
  };

  const handleToggleLike = (index: number, type: "like" | "dislike") => {
    setRatings((prev) => {
      const next = { ...prev };
      if (next[index] === type) {
        delete next[index];
      } else {
        next[index] = type;
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden relative bg-[#FAFAF8]">
      {/* Chat Log Window */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar relative"
      >
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full flex flex-col items-center justify-center text-center p-8 space-y-5"
          >
            <div className="w-14 h-14 rounded-2xl bg-white border border-black/10 flex items-center justify-center text-black shadow-sm">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="font-heading text-lg font-bold text-[#0A0A0A] tracking-tight">
                Startup Advisor Workspace
              </h3>
              <p className="text-neutral-600 text-xs leading-relaxed font-body">
                Pitch your startup to cross-reference against 150+ frameworks from YC, a16z, and NFX. Ask about moats, pricing, timing, or market size.
              </p>
            </div>

            {/* Quick Starter Suggestions */}
            <div className="flex flex-wrap gap-2 justify-center max-w-lg pt-2">
              {SUGGESTED_STARTER_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(prompt)}
                  className="px-3.5 py-1.5 rounded-full border border-black/10 bg-white hover:bg-black hover:text-white text-xs font-semibold text-neutral-800 transition-all duration-200 cursor-pointer shadow-xs active:scale-95"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {messages.map((msg, index) => {
              const isUser = msg.role === "user";
              const isLatestMessage = index === messages.length - 1;
              const isStreamingMessage = !isUser && isLatestMessage && isLoading;

              return (
                <motion.div
                  key={`${index}-${msg.role}`}
                  custom={isUser}
                  variants={messageVariants}
                  initial="hidden"
                  animate="visible"
                  layout
                  className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex items-start space-x-3.5 max-w-[94%] sm:max-w-[88%] ${isUser ? "flex-row-reverse space-x-reverse" : "flex-row"}`}>
                    
                    {/* Circle Avatars */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border select-none ${
                        isUser
                          ? "bg-neutral-800 border-neutral-700 text-white font-bold text-[11px]"
                          : "bg-black border-black text-white font-black text-xs shadow-xs"
                      }`}
                    >
                      {isUser ? (
                        <span>YOU</span>
                      ) : (
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                      )}
                    </div>

                    {/* Bubble box + Content */}
                    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} group min-w-0`}>
                      
                      {/* Speaker Label Row */}
                      <div className="flex items-center space-x-2 mb-1 px-1 select-none">
                        <span className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                          {isUser ? "You" : "Advisor"}
                        </span>
                        {msg.timestamp && (
                          <span className="text-[9px] text-neutral-400">
                            {getRelativeTime(msg.timestamp)}
                          </span>
                        )}
                      </div>

                      {/* Content Container */}
                      <div
                        className={`text-sm leading-relaxed transition-all duration-200 ${
                          isUser
                            ? "bg-[#0A0A0A] text-white border border-neutral-900 rounded-2xl rounded-tr-xs px-4.5 py-3 shadow-xs"
                            : "bg-white rounded-2xl border border-black/8 shadow-2xs px-4 sm:px-5 py-3.5 sm:py-4 w-full text-[#0A0A0A]"
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap font-body font-medium text-sm leading-relaxed text-neutral-50">
                            {msg.content}
                          </p>
                        ) : isStreamingMessage && msg.content === "" ? (
                          <div className="flex items-center space-x-2 text-neutral-600 py-1">
                            <span className="w-2 h-2 rounded-full bg-black animate-ping" />
                            <span className="text-xs font-semibold italic">
                              Analyzing frameworks & evaluating pitch...
                            </span>
                          </div>
                        ) : (
                          <div className="w-full">
                            {renderMarkdownContent(msg.content, isStreamingMessage)}
                          </div>
                        )}
                      </div>

                      {/* Action Bar (Copy / Like / Dislike / Edit) */}
                      <div className="flex items-center space-x-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-none">
                        <button
                          onClick={() => handleCopyMessage(msg.content, index)}
                          className="px-2 py-1 rounded-lg bg-white border border-black/10 text-neutral-600 hover:text-black hover:border-black/30 transition flex items-center space-x-1 text-[10px] font-medium cursor-pointer shadow-xs"
                          title="Copy text"
                        >
                          {copiedIndex === index ? (
                            <>
                              <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-emerald-700 font-bold">Copied</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        {isUser ? (
                          <button
                            onClick={() => handleEditUserMessage(msg.content)}
                            className="px-2 py-1 rounded-lg bg-white border border-black/10 text-neutral-600 hover:text-black hover:border-black/30 transition flex items-center space-x-1 text-[10px] font-medium cursor-pointer shadow-xs"
                            title="Edit message"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            <span>Edit</span>
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleToggleLike(index, "like")}
                              className={`p-1.5 rounded-lg border transition cursor-pointer shadow-xs ${
                                ratings[index] === "like"
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                                  : "bg-white border-black/10 text-neutral-600 hover:text-black"
                              }`}
                              title="Helpful critique"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleToggleLike(index, "dislike")}
                              className={`p-1.5 rounded-lg border transition cursor-pointer shadow-xs ${
                                ratings[index] === "dislike"
                                  ? "bg-rose-50 border-rose-300 text-rose-700"
                                  : "bg-white border-black/10 text-neutral-600 hover:text-black"
                              }`}
                              title="Needs improvement"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h3a2 2 0 012 2v7a2 2 0 01-2 2h-3" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>

                      {/* Interactive suggestion pills — shown only for the latest assistant message */}
                      {isLatestMessage && !isLoading && msg.suggested_followups && msg.suggested_followups.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, delay: 0.1 }}
                          className="flex flex-wrap gap-2 mt-4 select-none"
                        >
                          {msg.suggested_followups.map((pill, pIdx) => (
                            <button
                              key={pIdx}
                              onClick={() => onSendMessage(pill)}
                              className="px-3.5 py-1.5 text-xs text-left font-semibold rounded-full border border-black/12 bg-white text-neutral-800 hover:border-black hover:bg-black hover:text-white transition-all duration-200 cursor-pointer shadow-xs active:scale-95 flex items-center space-x-1.5"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                              <span>{pill}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}

                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll to Bottom helper */}
      <AnimatePresence>
        {showScrollBottom && (
          <motion.button
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            onClick={scrollToBottom}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-white border border-black/15 shadow-lg text-black text-xs font-semibold transition-all duration-200 z-40 flex items-center space-x-1.5 cursor-pointer hover:bg-neutral-50"
          >
            <span>Scroll to latest</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l-7 7-7-7m14-6l-7 7-7-7" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input panel capsule */}
      <div className="p-3 md:p-4 border-t border-black/10 bg-white/95 backdrop-blur-md flex-shrink-0 flex flex-col space-y-2">
        <form onSubmit={handleSubmit} className="flex items-end space-x-2.5 w-full">
          <div className="flex-1 relative rounded-2xl border border-black/12 bg-[#F7F7F6] focus-within:border-black/40 focus-within:bg-white focus-within:ring-2 focus-within:ring-black/5 transition-all duration-200 shadow-xs">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask the advisor about your startup idea... (Enter to send, Shift+Enter for newline)"
              rows={1}
              className="w-full pl-4 pr-12 py-3 bg-transparent text-[#0A0A0A] text-sm focus:outline-none resize-none font-body max-h-36 min-h-[44px] block overflow-y-auto custom-scrollbar leading-relaxed placeholder-neutral-400 font-medium"
            />
            {inputValue.length > 80 && (
              <span className="absolute bottom-2.5 right-4 text-[9px] font-bold text-neutral-400 select-none">
                {inputValue.length}
              </span>
            )}
          </div>
          <motion.button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            className="p-3 rounded-2xl bg-[#0A0A0A] text-white font-bold transition-all duration-200 hover:bg-neutral-800 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex items-center justify-center w-11 h-11 shrink-0 shadow-md"
          >
            {isLoading ? (
              <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </motion.button>
        </form>

        <div className="flex items-center justify-between px-1 text-[10px] text-neutral-500 select-none">
          <span>Advisor grounds answers in YC & a16z frameworks.</span>
          <span className="hidden sm:inline">Press <kbd className="px-1.5 py-0.5 rounded bg-neutral-200/80 text-neutral-700 font-mono text-[9px] border border-neutral-300">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-neutral-200/80 text-neutral-700 font-mono text-[9px] border border-neutral-300">/</kbd> to focus</span>
        </div>
      </div>
    </div>
  );
}
