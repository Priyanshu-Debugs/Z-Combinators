"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PageTransition from "../components/PageTransition";
import EvaluateForm from "../components/EvaluateForm";
import LoadingSkeleton from "../components/LoadingSkeleton";
import EvaluateResults from "../components/EvaluateResults";
import Disclaimer from "../components/Disclaimer";

type EvalState = "input" | "loading" | "results" | "error";

interface Dimension {
  dimension: string;
  score: number;
  justification: string;
  source_excerpt: string;
  source_framework: string;
  confidence: "high" | "medium" | "low";
}

interface EvaluationResult {
  overall_score: number;
  dimensions: Dimension[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Realistic demo data for static demo mode (Evaluate SaaS / Marketplace startup idea)
const DEMO_DATA: EvaluationResult = {
  overall_score: 7.3,
  dimensions: [
    {
      dimension: "Market",
      score: 8,
      justification: "The farm-to-restaurant organic marketplace targets a high-value, high-frequency transactional market. Restaurants spend a significant percentage of revenue on fresh ingredients. The demand for local, organic produce is steadily rising, aligning with YC frameworks emphasizing large addressable markets with growing sub-sectors.",
      source_excerpt: "A startup equals growth. You want to target a market that is either very big already or is growing rapidly, so that your customer base expands naturally alongside your product quality.",
      source_framework: "YC -- Startup Equals Growth",
      confidence: "high",
    },
    {
      dimension: "Team",
      score: 6,
      justification: "While the idea is solid, founder-market fit is not fully detailed. In YC and a16z frameworks, the team must have domain expertise in logistics or restaurant operations to execute effectively. A score of 6 reflects that the idea is viable, but execution capability is highly dependent on hiring strong operational talent.",
      source_excerpt: "We look for founders who have domain expertise or a deep personal connection to the problem they are solving. Founder-market fit is often more important than the idea itself in the early stages.",
      source_framework: "a16z -- Pmarca Guide to Startups",
      confidence: "medium",
    },
    {
      dimension: "Timing",
      score: 9,
      justification: "Excellent timing. Supply chain volatility, increasing consumer preference for organic/local food, and the adoption of modern ordering software by restaurants create a perfect inflection point. This aligns with NFX timing frameworks regarding technological and cultural readiness.",
      source_excerpt: "Timing is everything. You must ask yourself: why now? What has changed in the macro environment or technology stack in the last 1-2 years that makes this business possible today when it wasn't before?",
      source_framework: "NFX -- Why Timing Is Everything",
      confidence: "high",
    },
    {
      dimension: "Competition",
      score: 5,
      justification: "Highly fragmented and competitive space. The business competes against traditional broadline distributors (Sysco, US Foods) and newer local delivery networks. Differentiating structurally will require proprietary logistics tech, not just incremental service improvements, as defined by NFX scorecard frameworks.",
      source_excerpt: "If you enter a crowded market, you cannot win with incremental improvements. You need a 10x product or a structural business model difference that makes incumbents unable or unwilling to compete with you.",
      source_framework: "NFX -- Marketplace Scorecard",
      confidence: "medium",
    },
    {
      dimension: "Moat",
      score: 8,
      justification: "High potential for local two-sided network effects. As more local farms list their produce, more restaurants are drawn to the platform, and vice versa. This creates strong switching costs and a localized defensible moat, consistent with the NFX Network Effects Manual.",
      source_excerpt: "Marketplaces are hard to start but highly defensible once they reach liquidity. The two-sided network effect means each new participant adds value to all existing participants, making it very hard for a new entrant to displace you.",
      source_framework: "NFX -- The Network Effects Manual",
      confidence: "high",
    },
    {
      dimension: "Execution",
      score: 7,
      justification: "The path to MVP is straightforward but operationally intensive. The initial launch should focus on a single city, manual routing, and matching supply/demand before scaling software, adhering to Paul Graham's 'Do Things That Don't Scale' framework.",
      source_excerpt: "One of the most common reasons startups fail is they try to scale too early. You should start by doing things that don't scale -- like manually matching buyers and sellers, or personally delivering the product.",
      source_framework: "YC -- Do Things That Dont Scale",
      confidence: "high",
    },
  ],
};

function EvaluateContent() {
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "true";

  const [evalState, setEvalState] = useState<EvalState>("input");
  const [ideaText, setIdeaText] = useState("");
  const [results, setResults] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo) {
      setResults(DEMO_DATA);
      setEvalState("results");
    } else {
      setEvalState("input");
      setResults(null);
    }
  }, [isDemo]);

  const handleSubmit = async (idea: string) => {
    setIdeaText(idea);
    setEvalState("loading");
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        if (response.status === 429) {
          throw new Error("Rate limit reached. Please wait a moment before trying again.");
        }
        throw new Error(errData?.detail || "Evaluation failed. Please check your network and try again.");
      }

      const data: EvaluationResult = await response.json();
      setResults(data);
      setEvalState("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setEvalState("error");
    }
  };

  const handleReset = () => {
    setEvalState("input");
    setResults(null);
    setError(null);
    setIdeaText("");
    // Clear query params if any
    window.history.pushState({}, "", "/evaluate");
  };

  return (
    <PageTransition>
      <div className="flex-1 flex flex-col justify-between pt-28 md:pt-32 pb-16 px-5 sm:px-8 md:px-10 lg:px-16 max-w-4xl mx-auto w-full">
        <div className="flex-1 flex items-center justify-center w-full">
          {evalState === "input" && (
            <EvaluateForm onSubmit={handleSubmit} isLoading={false} />
          )}

          {evalState === "loading" && <LoadingSkeleton />}

          {evalState === "results" && results && (
            <EvaluateResults
              overallScore={results.overall_score}
              dimensions={results.dimensions}
              onReset={handleReset}
            />
          )}

          {evalState === "error" && (
            <div
              className="w-full max-w-md p-8 rounded-2xl border bg-surface text-center space-y-6 shadow-card"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="space-y-2">
                <h2 className="font-heading text-2xl font-semibold text-score-low">
                  Evaluation failed
                </h2>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {error}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="w-full py-3 rounded-full bg-accent text-accent-inverse text-base font-medium transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              >
                Go back
              </button>
            </div>
          )}
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
