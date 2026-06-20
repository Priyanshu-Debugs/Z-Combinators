"use client";

import { useState, useEffect } from "react";
import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";

interface RadarChartProps {
  scores: {
    dimension: string;
    score: number;
  }[];
}

export default function RadarChart({ scores }: RadarChartProps) {
  const [fontSize, setFontSize] = useState(11);

  useEffect(() => {
    const handleResize = () => {
      setFontSize(window.innerWidth < 640 ? 10 : 12);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const data = scores.map((s) => ({
    subject: s.dimension,
    value: s.score,
    fullMark: 10,
  }));

  return (
    <div id="evaluation-radar-chart" className="w-full max-w-sm mx-auto aspect-square flex items-center justify-center" style={{ minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="65%" data={data}>
          {/* SVG defs for subtle glow filter */}
          <defs>
            <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.25 0"
              />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0A0A0A" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#0A0A0A" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <PolarGrid stroke="var(--color-border)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{
              fill: "var(--color-text-primary)",
              fontSize: fontSize,
              fontWeight: 500,
              fontFamily: "var(--font-heading), sans-serif",
            }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 10]}
            tickCount={6}
            tick={{ fill: "var(--color-text-secondary)", fontSize: 10 }}
          />
          <Radar
            name="Evaluation"
            dataKey="value"
            stroke="#0A0A0A"
            strokeWidth={2}
            fill="url(#radarFill)"
            fillOpacity={1}
            isAnimationActive={true}
            animationDuration={1200}
            animationEasing="ease-out"
            dot={{
              r: 3.5,
              fill: "#0A0A0A",
              stroke: "#FFFFFF",
              strokeWidth: 2,
            }}
            filter="url(#radarGlow)"
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
