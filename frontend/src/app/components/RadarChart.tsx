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
  onSelectDimension?: (dimension: string) => void;
}

export default function RadarChart({ scores, onSelectDimension }: RadarChartProps) {
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
    <div id="evaluation-radar-chart" className="w-full max-w-sm mx-auto aspect-square flex items-center justify-center relative">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="68%" data={data}>
          {/* Subtle gradient for light theme radar */}
          <defs>
            <linearGradient id="radarFillLight" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0A0A0A" stopOpacity={0.14} />
              <stop offset="100%" stopColor="#0A0A0A" stopOpacity={0.03} />
            </linearGradient>
          </defs>

          {/* Clean light polar grid */}
          <PolarGrid stroke="rgba(0, 0, 0, 0.08)" strokeDasharray="3 3" />

          {/* Dimension Angle Labels */}
          <PolarAngleAxis
            dataKey="subject"
            tick={{
              fill: "#0A0A0A",
              fontSize: fontSize,
              fontWeight: 600,
              fontFamily: "var(--font-heading), sans-serif",
              cursor: onSelectDimension ? "pointer" : "default",
            }}
            onClick={(e) => {
              if (onSelectDimension && e && e.value) {
                onSelectDimension(String(e.value));
              }
            }}
          />

          <PolarRadiusAxis
            angle={30}
            domain={[0, 10]}
            tickCount={6}
            tick={{ fill: "#6B6B6B", fontSize: 9 }}
            axisLine={false}
          />

          <Radar
            name="Evaluation"
            dataKey="value"
            stroke="#0A0A0A"
            strokeWidth={2}
            fill="url(#radarFillLight)"
            fillOpacity={1}
            isAnimationActive={true}
            animationDuration={900}
            animationEasing="ease-out"
            dot={{
              r: 4,
              fill: "#0A0A0A",
              stroke: "#FFFFFF",
              strokeWidth: 2,
            }}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
