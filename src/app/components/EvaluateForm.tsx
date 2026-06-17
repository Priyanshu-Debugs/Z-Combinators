"use client";

import { useState } from "react";

interface EvaluateFormProps {
  onSubmit: (idea: string) => void;
  isLoading: boolean;
}

export default function EvaluateForm({ onSubmit, isLoading }: EvaluateFormProps) {
  const [idea, setIdea] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (idea.trim().length >= 20) {
      onSubmit(idea);
    }
  };

  const charCount = idea.length;
  const isValid = charCount >= 20 && charCount <= 2000;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <h1 className="font-heading text-3xl md:text-4xl font-semibold tracking-tight text-text-primary">
          What are you building?
        </h1>
        <p className="text-text-secondary text-base max-w-md mx-auto leading-relaxed">
          Describe your startup idea in 2-5 sentences. We will evaluate it against 150+ frameworks from YC, a16z, and NFX.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            disabled={isLoading}
            placeholder="e.g., A marketplace that connects local organic farmers directly with nearby restaurants. We handle the routing and logistics, cutting out high distributor markup and providing fresher produce..."
            maxLength={2000}
            className="w-full min-h-[180px] p-5 rounded-xl border border-border bg-surface text-text-primary text-base font-body placeholder:text-text-tertiary focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-black/5 disabled:opacity-50 transition-all resize-none shadow-sm"
          />
          <div className="absolute bottom-4 right-4 text-[13px] text-text-tertiary font-body">
            {charCount} / 2000
          </div>
        </div>

        {charCount > 0 && charCount < 20 && (
          <p className="text-score-low text-xs font-body">
            Please provide a bit more detail (at least 20 characters) to get a high-quality evaluation.
          </p>
        )}

        <div className="flex flex-col items-center gap-3">
          <button
            type="submit"
            disabled={!isValid || isLoading}
            className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-accent text-accent-inverse text-base font-medium transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isLoading ? "Analyzing..." : "Evaluate"}
          </button>
          
          <p className="text-[13px] text-text-tertiary font-body">
            Your idea is processed in real time and not stored on our servers.
          </p>
        </div>
      </form>
    </div>
  );
}
