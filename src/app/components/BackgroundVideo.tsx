"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export default function BackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReversing, setIsReversing] = useState(false);

  const framesRef = useRef<ImageBitmap[]>([]);
  const lastCapturedTimeRef = useRef<number>(0);
  const directionRef = useRef<"forward" | "backward">("forward");
  const reverseIndexRef = useRef<number>(0);
  const lastReverseTimeRef = useRef<number>(0);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let animationId: number;

    const handleLoadedMetadata = () => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
    };
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    // If metadata is already loaded, size canvas immediately
    if (video.videoWidth) {
      handleLoadedMetadata();
    }

    const captureLoop = async (now: number) => {
      if (!video || !canvas) return;

      if (directionRef.current === "forward") {
        const currentTime = video.currentTime;

        // Capture frames during forward play
        // Capture a frame every ~33ms (30fps) to keep playback smooth and memory usage light
        if (currentTime > 0 && currentTime > lastCapturedTimeRef.current + 0.033) {
          try {
            const bitmap = await createImageBitmap(video);
            framesRef.current.push(bitmap);
            lastCapturedTimeRef.current = currentTime;
          } catch (err) {
            // Ignore capture failures during initialization
          }
        }

        // Detect near-end of video to switch to reverse playback
        if (video.duration && currentTime >= video.duration - 0.12) {
          directionRef.current = "backward";
          setIsReversing(true);
          video.pause();

          reverseIndexRef.current = framesRef.current.length - 1;
          lastReverseTimeRef.current = performance.now();
        }
      } else if (directionRef.current === "backward" && framesRef.current.length > 0) {
        const elapsed = now - lastReverseTimeRef.current;

        // Play backward at ~30fps (~33.3ms per frame)
        const steps = Math.floor(elapsed / 33.3);
        if (steps > 0) {
          reverseIndexRef.current -= steps;
          lastReverseTimeRef.current = now;

          if (reverseIndexRef.current >= 0) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
              const bitmap = framesRef.current[reverseIndexRef.current];
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            }
          } else {
            // Reached start of clip, restart forward video playback
            directionRef.current = "forward";
            setIsReversing(false);

            // Clean up bitmaps from GPU memory to prevent leaks
            framesRef.current.forEach((bitmap) => bitmap.close());
            framesRef.current = [];

            lastCapturedTimeRef.current = 0;
            video.currentTime = 0;
            video.play().catch(() => {});
          }
        }
      }

      animationId = requestAnimationFrame(captureLoop);
    };

    animationId = requestAnimationFrame(captureLoop);

    return () => {
      cancelAnimationFrame(animationId);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      // Clean up frames on unmount
      framesRef.current.forEach((bitmap) => bitmap.close());
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full z-0 overflow-hidden pointer-events-none">
      <video
        ref={videoRef}
        autoPlay
        muted
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
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-150 ${
          isReversing ? "opacity-100" : "opacity-0"
        }`}
        style={{
          objectPosition: "70% center",
          filter: "contrast(1.03) brightness(0.99) saturate(0.98)",
        }}
      />
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
