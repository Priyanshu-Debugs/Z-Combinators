"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  evaluations?: unknown;
  timestamp?: number;
  suggested_followups?: string[];
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

/* ===== Custom Markdown Helper: Parsers for bold & inline code ===== */
function parseTextWithFormatting(text: string, isDone: boolean = true, isLast: boolean = false) {
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
        <code key={idx} className="px-1.5 py-0.5 rounded bg-text-secondary/5 border border-border text-text-primary font-mono text-[11px] font-semibold tracking-tight mx-0.5 select-all">
          {codeText}
        </code>
      );
    } else {
      parts.push(token);
    }
  });

  if (isLast && !isDone) {
    parts.push(<span key="cursor" className="typewriter-cursor" />);
  }

  return parts;
}

/* ===== Custom Markdown Renderer for bold, code, headings, quotes & lists ===== */
function renderMessageContent(text: string, isDone: boolean = true) {
  const paragraphs = text.split("\n\n");
  
  return paragraphs.map((para, pIdx) => {
    const isLastParagraph = pIdx === paragraphs.length - 1;
    const cleanPara = para.trim();
    
    // Headings
    if (cleanPara.startsWith("### ")) {
      return (
        <h3 key={pIdx} className="font-heading text-sm font-bold text-text-primary tracking-tight mt-4 mb-2 first:mt-1">
          {parseTextWithFormatting(cleanPara.slice(4), isDone, isLastParagraph)}
        </h3>
      );
    }
    if (cleanPara.startsWith("## ")) {
      return (
        <h2 key={pIdx} className="font-heading text-base font-bold text-text-primary tracking-tight mt-5 mb-2 first:mt-1">
          {parseTextWithFormatting(cleanPara.slice(3), isDone, isLastParagraph)}
        </h2>
      );
    }
    if (cleanPara.startsWith("# ")) {
      return (
        <h1 key={pIdx} className="font-heading text-lg font-bold text-text-primary tracking-tight mt-6 mb-2 first:mt-1">
          {parseTextWithFormatting(cleanPara.slice(2), isDone, isLastParagraph)}
        </h1>
      );
    }

    // Blockquotes
    if (cleanPara.startsWith("> ")) {
      return (
        <blockquote key={pIdx} className="border-l-2 border-accent/25 pl-4 py-1 italic text-text-secondary my-3 bg-accent/[0.01] rounded-r-lg">
          {parseTextWithFormatting(cleanPara.slice(2), isDone, isLastParagraph)}
        </blockquote>
      );
    }

    // Horizontal Rule
    if (cleanPara === "---") {
      return <hr key={pIdx} className="border-border/60 my-4" />;
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
        <div key={pIdx} className="space-y-1.5 my-2.5 pl-1">
          {lines.map((line, lIdx) => {
            const isLastLine = lIdx === lines.length - 1;
            const appendCursor = isLastParagraph && isLastLine && !isDone;
            
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

            const parsedLine = parseTextWithFormatting(content, isDone, appendCursor);

            if (isBullet) {
              return (
                <div key={lIdx} className="flex items-start space-x-2 pl-4">
                  <span className="text-text-secondary select-none font-bold text-[13px] mt-0.5">•</span>
                  <span className="text-text-secondary text-sm leading-relaxed font-body font-medium flex-1">{parsedLine}</span>
                </div>
              );
            }
            if (isNumbered) {
              return (
                <div key={lIdx} className="flex items-start space-x-2 pl-2">
                  <span className="text-text-primary font-bold text-xs select-none mt-1">{bulletNum}.</span>
                  <span className="text-text-secondary text-sm leading-relaxed font-body font-medium flex-1">{parsedLine}</span>
                </div>
              );
            }
            return (
              <p key={lIdx} className="text-text-secondary text-sm leading-relaxed font-body font-medium pl-1">
                {parsedLine}
              </p>
            );
          })}
        </div>
      );
    }

    // Standard paragraph
    return (
      <p key={pIdx} className="text-text-primary text-sm leading-relaxed font-body font-medium my-2 first:mt-0 last:mb-0">
        {parseTextWithFormatting(para, isDone, isLastParagraph)}
      </p>
    );
  });
}

/* ===== Typewriter Animation Component for Advisor Messages ===== */
interface TypewriterChatMessageProps {
  content: string;
  onComplete?: () => void;
  shouldAnimate: boolean;
  isStreaming?: boolean;
}

function TypewriterChatMessage({
  content,
  onComplete,
  shouldAnimate,
  isStreaming = false,
}: TypewriterChatMessageProps) {
  const [displayedText, setDisplayedText] = useState(shouldAnimate ? "" : content);
  const [isDone, setIsDone] = useState(!shouldAnimate);

  const prevStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      setIsDone(true);
      onComplete?.();
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, onComplete]);

  useEffect(() => {
    if (isDone && shouldAnimate && !isStreaming) {
      onComplete?.();
    }
  }, [isDone, shouldAnimate, isStreaming, onComplete]);

  useEffect(() => {
    if (isStreaming) {
      Promise.resolve().then(() => {
        setDisplayedText(content);
        setIsDone(false);
      });
      return;
    }

    if (!shouldAnimate) {
      Promise.resolve().then(() => {
        setDisplayedText(content);
        setIsDone(true);
      });
      return;
    }

    Promise.resolve().then(() => {
      setDisplayedText("");
      setIsDone(false);
    });

    let index = 0;
    const interval = setInterval(() => {
      setDisplayedText(() => {
        const remaining = content.length - index;
        const step = remaining > 350 ? 3 : remaining > 150 ? 2 : 1;
        const nextIndex = index + step;
        
        if (nextIndex >= content.length) {
          clearInterval(interval);
          setIsDone(true);
          return content;
        }
        index = nextIndex;
        return content.slice(0, nextIndex);
      });
    }, 18);

    return () => clearInterval(interval);
  }, [content, shouldAnimate, isStreaming]);

  return (
    <div className="w-full relative">
      <div className="inline-block w-full">{renderMessageContent(displayedText, isDone)}</div>
    </div>
  );
}

const messageVariants = {
  hidden: (isUser: boolean) => ({
    opacity: 0,
    x: isUser ? 16 : -16,
    scale: 0.97,
  }),
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.35,
      ease: "easeOut" as const,
    },
  },
};

export default function ChatInterface({
  messages,
  onSendMessage,
  isLoading,
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollFade, setShowScrollFade] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [ratings, setRatings] = useState<Record<number, "like" | "dislike">>({});
  const [messagesWithTimestamps] = useState<Map<number, number>>(new Map());
  const [animatedMessageIndices, setAnimatedMessageIndices] = useState<Set<number>>(new Set());

  // Track timestamps for newly appearing messages
  useEffect(() => {
    messages.forEach((_, i) => {
      if (!messagesWithTimestamps.has(i)) {
        messagesWithTimestamps.set(i, Date.now());
      }
    });
  }, [messages, messagesWithTimestamps]);

  // Auto-scroll to the bottom of the chat logs
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Track scroll position for fade gradient & scroll-to-bottom helper
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      setShowScrollFade(scrollTop > 24);
      setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 180);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    onSendMessage(inputValue.trim());
    setInputValue("");

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
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleCopyMessage = (content: string, index: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const handleToggleLike = (index: number, type: "like" | "dislike") => {
    setRatings((prev) => {
      const next = { ...prev };
      if (next[index] === type) {
        delete next[index]; // toggle off
      } else {
        next[index] = type;
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden relative">
      {/* Chat Log Window */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar relative ${
          showScrollFade ? "scroll-fade-top" : ""
        }`}
      >
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4"
          >
            <div className="icon-breathe w-14 h-14 rounded-2xl bg-accent/5 border border-accent/10 flex items-center justify-center text-accent shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="font-heading text-lg md:text-xl font-semibold text-text-primary tracking-tight">
                Startup Advisor
              </h3>
              <p className="text-text-secondary text-sm max-w-sm leading-relaxed font-body">
                Share your idea to start the evaluation. Ask about target markets, moats, timing, or how to address customer pain points.
              </p>
            </div>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {messages.map((msg, index) => {
              const isUser = msg.role === "user";
              const timestamp = messagesWithTimestamps.get(index);
              
              const isLatestMessage = index === messages.length - 1;
              const shouldAnimate = !isUser && isLatestMessage && !animatedMessageIndices.has(index);
              const isStreamingMessage = !isUser && isLatestMessage && isLoading;

              const handleComplete = () => {
                setAnimatedMessageIndices((prev) => {
                  const next = new Set(prev);
                  next.add(index);
                  return next;
                });
              };

              return (
                <motion.div
                  key={`${index}-${msg.role}`}
                  custom={isUser}
                  variants={messageVariants}
                  initial="hidden"
                  animate="visible"
                  layout
                  className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-4`}
                >
                  <div className={`flex items-start space-x-3.5 max-w-[92%] ${isUser ? "flex-row-reverse space-x-reverse" : "flex-row"}`}>
                    
                    {/* Premium Circle Avatars */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border select-none ${
                      isUser
                        ? "bg-accent/5 border-accent/15 text-accent font-bold text-xs"
                        : "bg-gradient-to-tr from-accent to-[#2b2b2b] border-[#1a1a1a] text-white"
                    }`}>
                      {isUser ? (
                        <span>U</span>
                      ) : (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l3.582-2.149 3.581 2.15-.985-5.097 3.916-3.41-5.228-.432L12 3 9.73 7.863l-5.228.432 3.916 3.41z" />
                        </svg>
                      )}
                    </div>

                    {/* Bubble box + Hover actions */}
                    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} group`}>
                      
                      {/* Speaker Label */}
                      <div className="flex items-center space-x-2 mb-1 px-1">
                        <span className="text-[10px] font-bold tracking-wider text-text-primary uppercase select-none">
                          {isUser ? "You" : "Advisor"}
                        </span>
                        {timestamp && (
                          <span className="text-[9px] text-text-tertiary select-none">
                            {getRelativeTime(timestamp)}
                          </span>
                        )}
                      </div>

                      {/* Bubble content */}
                      <div
                        className={`text-sm leading-relaxed transition-all duration-200 ${
                          isUser
                             ? "bg-surface border border-border/80 text-text-primary rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:bg-surface-hover/20"
                             : "text-text-primary px-1 py-0.5 w-full bg-transparent border-transparent shadow-none"
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap font-body font-medium">{msg.content}</p>
                        ) : (
                          <TypewriterChatMessage
                            content={msg.content}
                            shouldAnimate={shouldAnimate}
                            isStreaming={isStreamingMessage}
                            onComplete={handleComplete}
                          />
                        )}
                      </div>

                      {/* Copy & Rating Action row — shown only for Assistant when streaming ends */}
                      {!isUser && !isStreamingMessage && (
                        <div className="flex items-center space-x-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pl-1 select-none">
                          <button
                            onClick={() => handleCopyMessage(msg.content, index)}
                            className="p-1 rounded-lg hover:bg-text-secondary/5 text-text-secondary hover:text-text-primary transition-all duration-150 cursor-pointer flex items-center space-x-1 border border-transparent hover:border-border/30 bg-surface/10 backdrop-blur-sm"
                            title="Copy reply"
                          >
                            {copiedIndex === index ? (
                              <>
                                <svg className="w-3 h-3 text-score-high" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-[9px] font-bold text-score-high pl-0.5">Copied</span>
                              </>
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                          
                          <button
                            onClick={() => handleToggleLike(index, "like")}
                            className={`p-1.5 rounded-lg hover:bg-text-secondary/5 transition-all duration-150 cursor-pointer border border-transparent hover:border-border/30 bg-surface/10 backdrop-blur-sm ${
                              ratings[index] === "like" ? "text-score-high border-score-high/15 bg-score-high/5" : "text-text-secondary hover:text-text-primary"
                            }`}
                            title="Good response"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                            </svg>
                          </button>

                          <button
                            onClick={() => handleToggleLike(index, "dislike")}
                            className={`p-1.5 rounded-lg hover:bg-text-secondary/5 transition-all duration-150 cursor-pointer border border-transparent hover:border-border/30 bg-surface/10 backdrop-blur-sm ${
                              ratings[index] === "dislike" ? "text-score-low border-score-low/15 bg-score-low/5" : "text-text-secondary hover:text-text-primary"
                            }`}
                            title="Poor response"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h3a2 2 0 012 2v7a2 2 0 01-2 2h-3" />
                            </svg>
                          </button>
                        </div>
                      )}

                      {/* Interactive suggestion pills — shown only for the latest assistant message */}
                      {isLatestMessage && !isLoading && msg.suggested_followups && msg.suggested_followups.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, delay: 0.15 }}
                          className="flex flex-wrap gap-2 mt-4 pl-1 select-none"
                        >
                          {msg.suggested_followups.map((pill, pIdx) => (
                            <button
                              key={pIdx}
                              onClick={() => onSendMessage(pill)}
                              className="px-3.5 py-1.5 text-xs text-left font-semibold rounded-full border border-border bg-surface text-text-secondary hover:border-accent hover:text-accent hover:bg-accent/5 transition-all duration-200 cursor-pointer shadow-sm active:scale-95 flex items-center space-x-1"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-accent/20 shrink-0" />
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

        {/* Loading Indicator — Thinking / Evaluating */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.3 }}
              className="flex w-full justify-start mb-4"
            >
              <div className="flex items-start space-x-3.5 max-w-[92%]">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border select-none bg-gradient-to-tr from-accent to-[#2b2b2b] border-[#1a1a1a] text-white">
                  <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <div className="flex flex-col items-start">
                  <div className="flex items-center space-x-2 mb-1 px-1">
                    <span className="text-[10px] font-bold tracking-wider text-text-primary uppercase select-none">
                      Advisor
                    </span>
                  </div>
                  <div className="bg-transparent px-1 py-1 flex items-center space-x-2 text-text-secondary">
                    <span className="text-xs font-semibold italic animate-pulse">Running startup evaluation...</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
            className="absolute bottom-24 left-1/2 -translate-x-1/2 p-2.5 rounded-full bg-surface border border-border shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:bg-surface-hover hover:border-border-strong text-text-primary transition-all duration-200 z-40 flex items-center justify-center cursor-pointer"
            title="Scroll to bottom"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l-7 7-7-7m14-6l-7 7-7-7" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input panel capsule */}
      <div className="p-3 md:p-4 border-t bg-surface/40 backdrop-blur-md border-border flex-shrink-0 flex flex-col space-y-1.5">
        <form onSubmit={handleSubmit} className="flex items-end space-x-3 w-full">
          <div className="flex-1 relative rounded-2xl border border-border/80 bg-surface/75 focus-within:border-accent/35 focus-within:ring-3 focus-within:ring-accent/5 focus-within:bg-surface transition-all duration-250 shadow-[0_2px_8px_rgba(0,0,0,0.015)]">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask the advisor about your startup idea..."
              rows={1}
              className="w-full pl-4 pr-12 py-3 bg-transparent text-text-primary text-sm focus:outline-none resize-none font-body max-h-28 min-h-[44px] block overflow-y-auto custom-scrollbar leading-relaxed"
              style={{ transition: "height 120ms ease" }}
            />
            {inputValue.length > 100 && (
              <span className="absolute bottom-2.5 right-4 text-[9px] font-bold text-text-tertiary select-none">
                {inputValue.length}
              </span>
            )}
          </div>
          <motion.button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.92 }}
            className="p-3 rounded-2xl bg-accent text-accent-inverse transition-all duration-200 hover:bg-[#2b2b2b] active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex items-center justify-center w-11 h-11 shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-border"
          >
            <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </motion.button>
        </form>
        <span className="text-[10px] text-center text-text-secondary/65 font-medium select-none block mt-1">
          Advisor can make errors. Verify crucial YC/financial frameworks independently.
        </span>
      </div>
    </div>
  );
}
