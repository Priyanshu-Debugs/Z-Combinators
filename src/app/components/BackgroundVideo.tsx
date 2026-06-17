"use client";

import { useRef, useEffect } from "react";

const SENSITIVITY = 0.8;

export default function BackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const prevX = useRef<number | null>(null);
  const targetTime = useRef<number>(0);
  const isSeeking = useRef<boolean>(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // We do NOT autoplay. We scrub through the video based on mouse movement.
    const handleMouseMove = (e: MouseEvent) => {
      if (!video.duration || isNaN(video.duration)) return;
      if (prevX.current === null) {
        prevX.current = e.clientX;
        return;
      }
      const delta = e.clientX - prevX.current;
      prevX.current = e.clientX;
      
      const timeOffset =
        (delta / window.innerWidth) * SENSITIVITY * video.duration;
      
      targetTime.current = Math.max(
        0,
        Math.min(video.duration, targetTime.current + timeOffset)
      );

      if (!isSeeking.current) {
        isSeeking.current = true;
        video.currentTime = targetTime.current;
      }
    };

    const handleSeeked = () => {
      if (videoRef.current && Math.abs(videoRef.current.currentTime - targetTime.current) > 0.01) {
        videoRef.current.currentTime = targetTime.current;
      } else {
        isSeeking.current = false;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    video.addEventListener("seeked", handleSeeked);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      video.removeEventListener("seeked", handleSeeked);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      preload="auto"
      className="fixed inset-0 w-full h-full z-0 object-cover"
      style={{ objectPosition: "70% center" }}
    >
      <source src="/hero-bg.mp4" type="video/mp4" />
    </video>
  );
}
