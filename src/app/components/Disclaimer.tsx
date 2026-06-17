"use client";

export default function Disclaimer() {
  return (
    <div
      className="w-full border-t px-5 sm:px-8 py-4 text-center"
      style={{
        borderColor: "var(--color-border)",
        backgroundColor: "var(--color-surface)",
      }}
    >
      <p
        className="text-[13px] max-w-2xl mx-auto leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Z-Combinator applies established startup frameworks to your idea.
        This is structured feedback, not investment, legal, or business advice.
        Scores reflect framework alignment, not predictions of success.
      </p>
    </div>
  );
}
