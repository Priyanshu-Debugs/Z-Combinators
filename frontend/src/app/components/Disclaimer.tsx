"use client";

import { usePathname } from "next/navigation";

export default function Disclaimer() {
  const pathname = usePathname();
  const isEvaluate = pathname === "/evaluate";

  if (isEvaluate) {
    return (
      <footer className="w-full border-t border-black/6 bg-[#FAFAF8] py-1.5 px-4 text-center select-none shrink-0 z-10">
        <p className="text-[10px] text-neutral-400 font-medium tracking-tight">
          Z-Combinators applies YC, a16z & NFX frameworks. Structured educational feedback, not investment or legal advice.
        </p>
      </footer>
    );
  }

  return (
    <div
      className="w-full border-t px-5 sm:px-8 text-center transition-all duration-300 py-4"
      style={{
        borderColor: "var(--color-border)",
        backgroundColor: "var(--color-surface)",
      }}
    >
      <p
        className="max-w-2xl mx-auto leading-relaxed transition-all duration-300 text-[13px]"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Z-Combinators applies established startup frameworks to your idea.
        This is structured feedback, not investment, legal, or business advice.
        Scores reflect framework alignment, not predictions of success.
      </p>
    </div>
  );
}
