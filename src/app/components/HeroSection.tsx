"use client";

import { useTypewriter } from "../hooks/useTypewriter";
import ActionPills from "./ActionPills";

const TYPEWRITER_TEXT =
  "Don’t let a bad idea drain your time or a critical hackathon weekend. We cross-reference your pitch against 150+ frameworks from YC, a16z, and NFX to give you unvarnished, cited feedback. Now, what are you building?";

export default function HeroSection() {
  const { displayed, done } = useTypewriter({
    text: TYPEWRITER_TEXT,
    speed: 38,
    startDelay: 600,
  });

  return (
    <section className="relative z-10 min-h-screen flex flex-col justify-end pb-12 md:justify-center md:pb-0 px-5 sm:px-8 md:px-10 lg:px-16 overflow-hidden">
      <div className="max-w-2xl relative z-10 mt-20 md:mt-0">
        <p
          className="pointer-events-none select-none mb-5 sm:mb-6"
          style={{
            fontSize: "clamp(18px, 4vw, 26px)",
            lineHeight: 1.3,
            fontWeight: 600,
            color: "#000",
          }}
        >
          Skip the generic AI advice,
          <br />
          Get evaluations grounded in real frameworks.
        </p>

        <p
          className="text-black mb-6 sm:mb-8 font-body font-medium"
          style={{
            fontSize: "clamp(18px, 4vw, 26px)",
            lineHeight: 1.35,
            minHeight: "120px", // prevent layout shift during typing
          }}
        >
          {displayed}
          {!done && <span className="typewriter-cursor" />}
        </p>

        <ActionPills />
      </div>
    </section>
  );
}
