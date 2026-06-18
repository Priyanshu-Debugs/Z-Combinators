"use client";

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
  // Format the data to fit Recharts requirements
  const data = scores.map((s) => ({
    subject: s.dimension,
    value: s.score,
    fullMark: 10,
  }));

  return (
    <div className="w-full max-w-sm mx-auto aspect-square flex items-center justify-center" style={{ minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="65%" data={data}>
          <PolarGrid stroke="var(--color-border)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{
              fill: "var(--color-text-primary)",
              fontSize: 13,
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
            stroke="var(--color-radar-stroke)"
            fill="var(--color-radar-fill)"
            fillOpacity={0.6}
            isAnimationActive={true}
            animationDuration={800}
            dot={{ r: 3, fill: "var(--color-accent)" }}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
