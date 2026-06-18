"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  evaluations?: any;
  timestamp?: number;
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
}

const QUICK_ACTIONS = [
  "What are the biggest weaknesses in my execution plan?",
  "How can I build a defensible network effect moat?",
  "What macro timing trends make this idea viable now?",
  "Help me evaluate my target market size.",
];

function getRelativeTime(timestamp?: number): string {
  if (!timestamp) return "";
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ===== Custom Markdown Renderer for bold text and bullet/numbered lists ===== */
function renderMessageContent(text: string, isDone: boolean = true) {
  const paragraphs = text.split("\n\n");
  const cursorNode = !isDone ? (
    <span key="cursor" className="typewriter-cursor" />
  ) : null;
  
  return paragraphs.map((para, pIdx) => {
    const isLastParagraph = pIdx === paragraphs.length - 1;
    const lines = para.split("\n");
    const isList = lines.some(line => 
      line.trim().startsWith("•") || 
      line.trim().startsWith("*") || 
      line.trim().startsWith("-") || 
      /^\d+\.\s/.test(line.trim())
    );

    if (isList) {
      return (
        <div key={pIdx} className="space-y-1.5 my-2">
          {lines.map((line, lIdx) => {
            const isLastLine = lIdx === lines.length - 1;
            const appendCursor = isLastParagraph && isLastLine && !isDone;
            
            const isBullet = line.trim().startsWith("•") || line.trim().startsWith("*") || line.trim().startsWith("-");
            const isNumbered = /^\d+\.\s/.test(line.trim());
            
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

            // Normalize uneven asterisks during typing
            let normalizedContent = content;
            const starCount = (content.match(/\*\*/g) || []).length;
            if (starCount % 2 !== 0) {
              normalizedContent = content + "**";
            }

            // Parse bold text **word**
            const parts: any[] = [];
            const regex = /\*\*(.*?)\*\*/g;
            let match;
            let lastIndex = 0;
            
            while ((match = regex.exec(normalizedContent)) !== null) {
              const matchIndex = match.index;
              if (matchIndex > lastIndex) {
                parts.push(normalizedContent.substring(lastIndex, matchIndex));
              }
              parts.push(
                <strong key={matchIndex} className="font-bold text-text-primary">
                  {match[1]}
                </strong>
              );
              lastIndex = regex.lastIndex;
            }
            if (lastIndex < normalizedContent.length) {
              parts.push(normalizedContent.substring(lastIndex));
            }

            if (appendCursor) {
              parts.push(cursorNode);
            }

            const renderedLine = parts.length > 0 ? parts : [content, appendCursor && cursorNode];

            if (isBullet) {
              return (
                <div key={lIdx} className="flex items-start space-x-2 pl-4">
                  <span className="text-text-tertiary select-none font-medium">•</span>
                  <span className="text-text-secondary text-sm leading-relaxed font-body font-medium">{renderedLine}</span>
                </div>
              );
            }
            if (isNumbered) {
              return (
                <div key={lIdx} className="flex items-start space-x-2 pl-2">
                  <span className="text-text-secondary font-semibold text-sm select-none">{bulletNum}.</span>
                  <span className="text-text-secondary text-sm leading-relaxed font-body font-medium">{renderedLine}</span>
                </div>
              );
            }
            return (
              <p key={lIdx} className="text-text-primary text-sm leading-relaxed font-body font-medium">
                {renderedLine}
              </p>
            );
          })}
        </div>
      );
    }

    // Standard paragraph, normalize uneven asterisks
    let normalizedPara = para;
    const starCount = (para.match(/\*\*/g) || []).length;
    if (starCount % 2 !== 0) {
      normalizedPara = para + "**";
    }

    const parts: any[] = [];
    const regex = /\*\*(.*?)\*\*/g;
    let match;
    let lastIndex = 0;
    
    while ((match = regex.exec(normalizedPara)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push(normalizedPara.substring(lastIndex, matchIndex));
      }
      parts.push(
        <strong key={matchIndex} className="font-bold text-text-primary">
          {match[1]}
        </strong>
      );
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < normalizedPara.length) {
      parts.push(normalizedPara.substring(lastIndex));
    }

    if (isLastParagraph && !isDone) {
      parts.push(cursorNode);
    }

    const renderedPara = parts.length > 0 ? parts : [para, !isDone && cursorNode];

    return (
      <p key={pIdx} className="text-text-primary text-sm leading-relaxed font-body font-medium">
        {renderedPara}
      </p>
    );
  });
}

/* ===== Typewriter Animation Component for Advisor Messages ===== */
interface TypewriterChatMessageProps {
  content: string;
  onComplete?: () => void;
  shouldAnimate: boolean;
}

function TypewriterChatMessage({
  content,
  onComplete,
  shouldAnimate,
}: TypewriterChatMessageProps) {
  const [displayedText, setDisplayedText] = useState(shouldAnimate ? "" : content);
  const [isDone, setIsDone] = useState(!shouldAnimate);

  useEffect(() => {
    if (isDone && shouldAnimate) {
      onComplete?.();
    }
  }, [isDone, shouldAnimate, onComplete]);

  useEffect(() => {
    if (!shouldAnimate) {
      setDisplayedText(content);
      setIsDone(true);
      return;
    }

    setDisplayedText("");
    setIsDone(false);

    let index = 0;
    const interval = setInterval(() => {
      setDisplayedText((prev) => {
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
  }, [content, shouldAnimate]);

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

const suggestionsContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const suggestionItemVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: "easeOut" as const },
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

  // Track scroll position for fade gradient
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      setShowScrollFade(scrollContainerRef.current.scrollTop > 24);
    }
  }, []);

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

  const handlePillClick = (actionText: string) => {
    setInputValue(actionText);
    inputRef.current?.focus();
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
        }
      }, 0);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Chat Log Window */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto p-3 md:p-4 space-y-3 custom-scrollbar relative ${
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
                  className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex flex-col space-y-0.5 ${isUser ? "items-end max-w-[85%] md:max-w-[80%]" : "items-start w-full max-w-[95%] md:max-w-[92%]"}`}>
                    {/* Speaker Label */}
                    <div className="flex items-center space-x-2 px-1">
                      <span className="text-[9px] font-bold tracking-wider text-text-secondary uppercase select-none">
                        {isUser ? "You" : "Advisor"}
                      </span>
                      {timestamp && (
                        <span className="text-[8px] text-text-tertiary select-none">
                          {getRelativeTime(timestamp)}
                        </span>
                      )}
                    </div>

                    {/* Message Body — Gemini/Claude style: clean background-less styling for AI responses, elegant pill box for user */}
                    <div
                      className={`text-sm leading-relaxed transition-all duration-200 ${
                        isUser
                          ? "bg-surface border border-border/60 text-text-primary rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:bg-surface-hover/30"
                          : "bg-transparent border-transparent text-text-primary shadow-none px-1 py-1 w-full"
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap font-body font-medium">{msg.content}</p>
                      ) : (
                        <TypewriterChatMessage
                          content={msg.content}
                          shouldAnimate={shouldAnimate}
                          onComplete={handleComplete}
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {/* Loading Indicator — smooth pulse dots */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.3 }}
              className="flex w-full justify-start"
            >
              <div className="flex flex-col space-y-0.5 items-start">
                <span className="text-[9px] font-bold tracking-wider text-text-secondary uppercase select-none px-1">
                  Advisor
                </span>
                <div className="bg-transparent px-1 py-1 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-accent dot-pulse dot-pulse-1" />
                  <span className="w-2 h-2 rounded-full bg-accent/70 dot-pulse dot-pulse-2" />
                  <span className="w-2 h-2 rounded-full bg-accent/40 dot-pulse dot-pulse-3" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input & Quick Action Panel */}
      <div className="p-2.5 md:p-3 border-t bg-surface/50 backdrop-blur-md border-border space-y-2.5 flex-shrink-0">
        {/* Suggestion Cards Grid — shown only when chat is empty */}
        {messages.length === 0 && (
          <motion.div
            variants={suggestionsContainerVariants}
            initial="hidden"
            animate="show"
            className="w-full"
          >
            <span className="text-[9px] font-bold tracking-wider text-text-secondary uppercase select-none block mb-1 px-0.5">
              Suggested Questions
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 w-full">
              {QUICK_ACTIONS.map((action, i) => (
                <motion.button
                  key={i}
                  variants={suggestionItemVariants}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handlePillClick(action)}
                  className="px-2.5 py-1.5 text-left rounded-lg border border-border bg-surface text-text-secondary text-[10px] font-semibold transition-all duration-200 hover:border-accent/30 hover:bg-accent/5 hover:text-accent active:scale-98 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.01)] leading-normal flex items-start"
                >
                  <span className="mr-1 text-accent/30">•</span>
                  <span className="flex-1 line-clamp-1">{action}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Message Input Box */}
        <form onSubmit={handleSubmit} className="flex items-end space-x-3 w-full">
          <div className="flex-1 relative rounded-xl border border-border bg-surface focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/5 transition-all duration-200">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask the advisor about your startup idea..."
              rows={1}
              className="w-full pl-4 pr-12 py-2.5 bg-transparent text-text-primary text-sm focus:outline-none resize-none font-body max-h-24 min-h-[40px] block overflow-y-auto custom-scrollbar"
              style={{ transition: "height 150ms ease" }}
            />
            {/* Character count — appears after 100 chars */}
            {inputValue.length > 100 && (
              <span className="absolute bottom-1.5 right-3 text-[9px] text-text-tertiary select-none">
                {inputValue.length}
              </span>
            )}
          </div>
          <motion.button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.88 }}
            className="p-2.5 rounded-xl bg-accent text-accent-inverse transition-all duration-200 hover:bg-[#1a1a1a] active:scale-95 disabled:opacity-35 disabled:pointer-events-none cursor-pointer flex items-center justify-center w-10 h-10 shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
          >
            <svg className="w-4.5 h-4.5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </motion.button>
        </form>
      </div>
    </div>
  );
}
