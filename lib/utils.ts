import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names, letting later classes win conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Round to `digits` decimals. */
export function round(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** Arithmetic mean; returns null for an empty list. */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Population standard deviation; returns 0 for fewer than 2 values. */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Shannon entropy of a distribution with `buckets` possible values, in nats. */
export function shannonEntropy(counts: number[], total: number): number {
  if (total <= 0) return 0;
  let h = 0;
  for (const c of counts) {
    if (c <= 0) continue;
    const p = c / total;
    h -= p * Math.log(p);
  }
  return h;
}

/** Jaccard similarity between two sets of numbers (0 when both are empty). */
export function jaccardSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const v of setA) if (setB.has(v)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

/** Mean value of `fn` over every unordered pair of `items`. */
export function meanOverPairs<T>(
  items: T[],
  fn: (a: T, b: T) => number
): number {
  if (items.length < 2) return 0;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      sum += fn(items[i], items[j]);
      n += 1;
    }
  }
  return n === 0 ? 0 : sum / n;
}

/** Format an integer with thousands separators for the given locale. */
export function formatNumber(value: number | null, locale: string): string {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale).format(Math.round(value));
}

/** Format a compact number (12.3K / 4.5M). */
export function formatCompact(value: number | null, locale: string): string {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Format a USD revenue figure compactly ($263M). */
export function formatMoney(value: number | null, locale: string): string {
  if (value === null || value <= 0) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Fixed-decimal number, with an em dash for missing values. */
export function formatScore(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}
