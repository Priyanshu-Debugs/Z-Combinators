"use client";

import { motion } from "framer-motion";

export default function BackgroundVideo() {
  return (
    <div className="fixed inset-0 w-full h-full z-0 overflow-hidden pointer-events-none">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover opacity-100"
        style={{
          objectPosition: "70% center",
          filter: "contrast(1.03) brightness(0.99) saturate(0.98)",
        }}
      >
        <source src="/hero-bg.mp4" type="video/mp4" />
      </video>
      {/* Premium subtle gradient overlay — keeps video extremely crisp and high-contrast */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, rgba(250,250,248,0.1) 0%, rgba(250,250,248,0) 60%, rgba(250,250,248,0.08) 100%)",
        }}
      />
    </div>
  );
}
