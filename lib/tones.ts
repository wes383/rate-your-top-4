import type { DimensionKey, Tier } from "@/lib/types";

/**
 * Colour mapping for scores. Class names are written as full literals so the
 * Tailwind scanner can see them.
 */

export const TIER_CLASS: Record<Tier, string> = {
  S: "border-green-border bg-green-soft text-green-fg",
  A: "border-blue-border bg-blue-soft text-blue-fg",
  B: "border-yellow-border bg-yellow-soft text-yellow-fg",
  C: "border-orange-border bg-orange-soft text-orange-fg",
  F: "border-red-border bg-red-soft text-red-fg",
};

export const TIER_STROKE: Record<Tier, string> = {
  S: "var(--green)",
  A: "var(--blue)",
  B: "var(--yellow)",
  C: "var(--orange)",
  F: "var(--red)",
};

export const DIM_BAR: Record<string, string> = {
  quality: "bg-tone-indigo",
  variety: "bg-tone-teal",
  coherence: "bg-tone-amber",
  identity: "bg-tone-violet",
  recognition: "bg-tone-rose",
  audience: "bg-tone-sky",
  legacy: "bg-tone-purple",
  awards: "bg-tone-amber",
  footprint: "bg-tone-cyan",
};

export const DIM_DOT: Record<string, string> = {
  quality: "bg-tone-indigo",
  variety: "bg-tone-teal",
  coherence: "bg-tone-amber",
  identity: "bg-tone-violet",
  recognition: "bg-tone-rose",
};

export const DIM_STROKE: Record<string, string> = {
  quality: "var(--color-indigo-tone)",
  variety: "var(--color-teal-tone)",
  coherence: "var(--color-amber-tone)",
  identity: "var(--color-violet-tone)",
  recognition: "var(--color-rose-tone)",
};

export function filmDimensionTone(key: DimensionKey): string {
  return DIM_BAR[key] ?? "bg-accent";
}
