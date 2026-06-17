"use client";

import { useState, useRef, useEffect } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  evaluations?: any;
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

export default function ChatInterface({
  messages,
  onSendMessage,
  isLoading,
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to the bottom of the chat logs
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    onSendMessage(inputValue.trim());
    setInputValue("");
    
    // Auto-adjust height back to single line
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
    // Auto-expand height if needed
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
        }
      }, 0);
    }
  };

  // Auto-resize textarea height as user types
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  return (
    <div
      className="flex flex-col h-[650px] w-full rounded-2xl border bg-surface/40 backdrop-blur-xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-border transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]"
    >
      {/* Chat Log Window */}
      <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-accent/5 border border-accent/10 flex items-center justify-center text-accent shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="font-heading text-xl font-semibold text-text-primary tracking-tight">
                Startup School Advisor Chat
              </h3>
              <p className="text-text-secondary text-sm max-w-sm leading-relaxed font-body">
                Share your idea to start the evaluation. Ask about target markets, moats, timing, or how to address customer pain points.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={index}
                className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div className={`flex flex-col space-y-1.5 max-w-[85%] sm:max-w-[78%] ${isUser ? "items-end" : "items-start"}`}>
                  {/* Speaker Label */}
                  <span className="text-[10px] font-bold tracking-wider text-text-secondary uppercase select-none px-1">
                    {isUser ? "You" : "Advisor"}
                  </span>
                  
                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl px-4.5 py-3.5 text-sm leading-relaxed shadow-[0_2px_8px_rgba(0,0,0,0.02)] border transition-all duration-200 ${
                      isUser
                        ? "bg-[#0A0A0A] text-white border-transparent rounded-tr-none hover:bg-[#151515]"
                        : "bg-surface border-border/80 text-text-primary rounded-tl-none hover:border-border"
                    }`}
                  >
                    <p className="whitespace-pre-wrap font-body font-medium">{msg.content}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex w-full justify-start">
            <div className="flex flex-col space-y-1.5 items-start">
              <span className="text-[10px] font-bold tracking-wider text-text-secondary uppercase select-none px-1">
                Advisor
              </span>
              <div className="bg-surface border border-border/85 rounded-2xl rounded-tl-none px-5 py-4.5 shadow-sm flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-accent/70 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input & Quick Action Panel */}
      <div className="p-4 md:p-5 border-t bg-surface/50 backdrop-blur-md border-border space-y-4">
        {/* Suggestion Pills */}
        <div className="relative -mx-4 md:-mx-5 px-4 md:px-5">
          {/* Scroll fade overlays */}
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-surface to-transparent pointer-events-none z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent pointer-events-none z-10" />
          
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none scroll-smooth">
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={i}
                onClick={() => handlePillClick(action)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full border border-border bg-surface text-text-secondary text-[11px] font-semibold transition-all duration-200 hover:border-accent/40 hover:bg-accent/5 hover:text-accent whitespace-nowrap active:scale-95 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        {/* Message Input Box */}
        <form onSubmit={handleSubmit} className="flex items-end space-x-3 w-full">
          <div className="flex-1 relative rounded-xl border border-border bg-surface focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/5 transition-all duration-200">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask the advisor about your startup idea..."
              rows={1}
              className="w-full pl-4 pr-12 py-3 bg-transparent text-text-primary text-sm focus:outline-none resize-none font-body max-h-32 min-h-[44px] block overflow-y-auto custom-scrollbar"
            />
          </div>
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="p-3 rounded-xl bg-accent text-accent-inverse transition-all duration-200 hover:bg-[#1a1a1a] active:scale-95 disabled:opacity-35 disabled:pointer-events-none cursor-pointer flex items-center justify-center w-11 h-11 shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
          >
            <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
