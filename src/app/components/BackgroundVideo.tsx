"use client";

export default function BackgroundVideo() {
  return (
    <video
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      className="fixed inset-0 w-full h-full z-0 object-cover pointer-events-none"
      style={{ objectPosition: "70% center" }}
    >
      <source src="/hero-bg.mp4" type="video/mp4" />
    </video>
  );
}
