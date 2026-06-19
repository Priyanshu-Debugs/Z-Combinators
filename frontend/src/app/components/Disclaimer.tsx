"use client";

import { usePathname } from "next/navigation";

export default function Disclaimer() {
  const pathname = usePathname();
  const isEvaluate = pathname === "/evaluate";

  return (
    <div
      className={`w-full border-t px-5 sm:px-8 text-center transition-all duration-300 ${isEvaluate ? "py-2.5" : "py-4"
        }`}
      style={{
        borderColor: "var(--color-border)",
        backgroundColor: "var(--color-surface)",
      }}
    >
      <p
        className={`max-w-2xl mx-auto leading-relaxed transition-all duration-300 ${isEvaluate ? "text-[11px]" : "text-[13px]"
          }`}
        style={{ color: "var(--color-text-secondary)" }}
      >
        Z-Combinators applies established startup frameworks to your idea.
        This is structured feedback, not investment, legal, or business advice.
        Scores reflect framework alignment, not predictions of success.
      </p>
    </div>
  );
}
