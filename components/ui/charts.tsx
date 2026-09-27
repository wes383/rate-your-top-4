import * as React from "react";
import { cn } from "@/lib/utils";
import {
  RADAR_LABEL_FONT_SIZE,
  RADAR_LABEL_LINE_HEIGHT,
  radarAngle,
  radarLayout,
} from "@/lib/radar-layout";

/* ── Horizontal metric bar ────────────────────────────────────── */

export function StatBar({
  value,
  max = 100,
  tone = "bg-accent",
  className,
  height = 6,
  muted = false,
}: {
  value: number;
  max?: number;
  tone?: string;
  className?: string;
  height?: number;
  muted?: boolean;
}) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-hover-bg-strong", className)}
      style={{ height }}
      role="presentation"
    >
      <div
        className={cn("h-full rounded-full transition-all duration-slower ease-out", tone)}
        style={{ width: `${pct}%`, opacity: muted ? 0.45 : 1 }}
      />
    </div>
  );
}

/* ── Score ring ───────────────────────────────────────────────── */

export function ScoreRing({
  value,
  size = 132,
  strokeWidth = 10,
  tone = "var(--accent)",
  children,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  tone?: string;
  children?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke="var(--hover-bg-strong)"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          stroke={tone}
          className="transition-all duration-slower ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

/* ── Radar chart ──────────────────────────────────────────────── */

export interface RadarAxis {
  key: string;
  label: string;
  value: number;
  tone: string;
}

/* Axis label layout lives in `lib/radar-layout.ts` so the geometry can be
   verified without a DOM. The plotted radius shrinks until every label fits
   inside the SVG box, and over-long latin labels wrap onto another line. */

/**
 * Five-axis radar. Values are 0-100; the grid draws rings at 25/50/75/100.
 * Colours come from CSS variables so the chart follows the active theme.
 */
export function RadarChart({
  axes,
  size = 260,
  levels = 4,
}: {
  axes: RadarAxis[];
  size?: number;
  levels?: number;
}) {
  const { center, radius, labels: labelLayouts } = radarLayout(
    axes.map((axis) => axis.label),
    size
  );
  const count = axes.length;

  const pointAt = (index: number, ratio: number) => {
    const angle = radarAngle(index, count);
    return [
      center + Math.cos(angle) * radius * ratio,
      center + Math.sin(angle) * radius * ratio,
    ] as const;
  };

  const polygon = axes
    .map((axis, index) => pointAt(index, Math.max(0, Math.min(100, axis.value)) / 100).join(","))
    .join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={axes.map((a) => `${a.label}: ${Math.round(a.value)}`).join(", ")}
    >
      {Array.from({ length: levels }, (_, level) => {
        const ratio = (level + 1) / levels;
        const points = axes
          .map((_, index) => pointAt(index, ratio).join(","))
          .join(" ");
        return (
          <polygon
            key={level}
            points={points}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1}
          />
        );
      })}

      {axes.map((axis, index) => {
        const [x, y] = pointAt(index, 1);
        return (
          <line
            key={axis.key}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            stroke="var(--border)"
            strokeWidth={1}
          />
        );
      })}

      <polygon
        points={polygon}
        fill="var(--accent)"
        fillOpacity={0.14}
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {axes.map((axis, index) => {
        const [x, y] = pointAt(index, Math.max(0, Math.min(100, axis.value)) / 100);
        return (
          <circle key={axis.key} cx={x} cy={y} r={3.5} fill={axis.tone} stroke="var(--surface)" strokeWidth={1.5} />
        );
      })}

      {axes.map((axis, index) => {
        const { x, y, lines } = labelLayouts[index];
        const lineHeight = RADAR_LABEL_FONT_SIZE * RADAR_LABEL_LINE_HEIGHT;
        // Offset the first line so a multi-line block stays centred on the anchor.
        const firstDy = -((lines.length - 1) * lineHeight) / 2;
        return (
          <text
            key={axis.key}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={RADAR_LABEL_FONT_SIZE}
            fill="var(--foreground-subtle)"
          >
            {lines.map((line, lineIndex) => (
              <tspan key={lineIndex} x={x} dy={lineIndex === 0 ? firstDy : lineHeight}>
                {line}
              </tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-shimmer rounded-md bg-hover-bg-strong", className)}
      aria-hidden="true"
    />
  );
}
