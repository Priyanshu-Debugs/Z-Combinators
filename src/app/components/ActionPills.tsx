"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const PILLS = [
  { label: "See our methodology", href: "/methodology", primary: false },
  { label: "Read the architecture", href: "/about", primary: false },
];

export default function ActionPills() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(timeout);
  }, []);

  const primaryBtnClass =
    "inline-flex items-center justify-center bg-black text-white border border-black rounded-full text-base sm:text-lg md:text-xl px-8 py-3.5 sm:px-10 sm:py-4 hover:bg-white hover:text-black hover:border-black transition-all duration-300 cursor-pointer shadow-lg hover:shadow-xl font-bold active:scale-95 w-full sm:w-auto text-center";

  const secondaryPillClass =
    "inline-flex items-center justify-center bg-white/70 text-black border border-black/10 rounded-full text-sm sm:text-base px-5 py-2.5 sm:px-6 sm:py-3 hover:bg-black hover:text-white transition-all duration-300 cursor-pointer shadow-sm";

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 pills-container ${
        visible ? "visible" : ""
      }`}
    >
      {/* Large prominent Validate Idea Button */}
      <Link href="/evaluate" className={primaryBtnClass}>
        Validate your Idea
        <svg
          className="ml-2 w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </Link>

      {/* Secondary pills */}
      <div className="flex flex-wrap gap-2.5 sm:gap-3">
        {PILLS.map((pill) => (
          <Link
            key={pill.label}
            href={pill.href}
            className={secondaryPillClass}
          >
            {pill.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
