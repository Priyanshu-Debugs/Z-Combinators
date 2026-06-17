"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const PILLS = [
  { label: "Validate your Idea", href: "/evaluate", primary: true },
  { label: "View sample radar chart", href: "/evaluate?demo=true", primary: false },
  { label: "See our methodology", href: "/methodology", primary: false },
  { label: "Read the architecture", href: "/about", primary: false },
];

export default function ActionPills() {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(timeout);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText("ping@z-combinator.com");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard API unavailable or permission denied */
    }
  };

  const whitePillClass =
    "inline-flex items-center justify-center bg-white text-black border border-black/10 rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.5em] hover:bg-black hover:text-white transition-colors duration-200 cursor-pointer shadow-sm";

  const primaryPillClass =
    "inline-flex items-center justify-center bg-black text-white border border-black rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.5em] hover:bg-white hover:text-black hover:border-black transition-colors duration-200 cursor-pointer shadow-sm font-medium";

  const outlinePillClass =
    "inline-flex items-center justify-center bg-transparent text-black border border-black/40 rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.5em] gap-2 hover:bg-black hover:text-white hover:border-black transition-colors duration-200 cursor-pointer shadow-sm";

  return (
    <div
      className={`flex flex-wrap gap-2 sm:gap-3 pills-container ${
        visible ? "visible" : ""
      }`}
    >
      {PILLS.map((pill) => (
        <Link
          key={pill.label}
          href={pill.href}
          className={pill.primary ? primaryPillClass : whitePillClass}
        >
          {pill.label}
        </Link>
      ))}
      <button onClick={handleCopy} className={outlinePillClass}>
        <span>
          {copied ? "Copied!" : "Ping us: ping@z-combinator.com"}
        </span>
        {!copied && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
}
