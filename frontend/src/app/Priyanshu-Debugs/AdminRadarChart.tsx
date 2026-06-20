"use client";

import React from "react";
import {
  ResponsiveContainer,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

interface AdminRadarChartProps {
  data: { subject: string; value: number; fullMark: number }[];
}

export default function AdminRadarChart({ data }: AdminRadarChartProps) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <ResponsiveContainer width="100%" height={260}>
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <defs>
            <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0A0A0A" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#0A0A0A" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <PolarGrid stroke="var(--color-border)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{
              fill: "var(--color-text-primary)",
              fontSize: 10,
              fontWeight: 500,
              fontFamily: "var(--font-heading), sans-serif",
            }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 10]}
            tickCount={6}
            tick={{ fill: "var(--color-text-secondary)", fontSize: 9 }}
          />
          <Radar
            name="Platform Average"
            dataKey="value"
            stroke="#0A0A0A"
            strokeWidth={2}
            fill="url(#radarFill)"
            fillOpacity={1}
            dot={{
              r: 3,
              fill: "#0A0A0A",
              stroke: "#FFFFFF",
              strokeWidth: 1.5,
            }}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
