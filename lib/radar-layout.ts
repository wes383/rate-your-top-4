/**
 * Pure layout maths for the radar chart.
 *
 * Kept out of the component so the geometry can be checked without a DOM. The
 * axis labels sit outside the plotted area, so a label on a near-horizontal
 * axis can run past the SVG edge and be silently clipped; `radarLayout` shrinks
 * the plotted radius until every label fits inside the `size` box, wrapping
 * over-long latin labels first.
 */

/** Label font size, in px. */
export const RADAR_LABEL_FONT_SIZE = 11;
/** Line height, as a multiple of the font size. */
export const RADAR_LABEL_LINE_HEIGHT = 1.2;
/** Label distance from the centre, as a multiple of the plotted radius. */
export const RADAR_LABEL_SCALE = 1.16;
/** Minimum gap between a label box and the SVG edge, in px. */
export const RADAR_LABEL_PADDING = 5;
/** Labels wider than this (in em units) wrap onto another line. */
export const RADAR_LABEL_MAX_LINE_UNITS = 7;
/** Keeps the plot clear of the box even when the labels are short. */
export const RADAR_LABEL_RADIUS_INSET = 34;

export interface RadarLabelLayout {
  /** Lines the label is drawn on, top to bottom. */
  lines: string[];
  /** Anchor point, in SVG user units. */
  x: number;
  y: number;
  /** Horizontal half-extent of the label box, in px. */
  halfWidth: number;
  /** Vertical half-extent of the label box, in px. */
  halfHeight: number;
}

export interface RadarLayout {
  center: number;
  radius: number;
  labels: RadarLabelLayout[];
}

/**
 * Estimated advance width of one character, in em units: CJK glyphs are full
 * width, latin and punctuation average around 0.55em. Only used to reserve
 * label space, so an approximation is enough.
 */
function charUnits(char: string): number {
  return /[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFF60\uF900-\uFAFF]/.test(char) ? 1 : 0.55;
}

/** Advance width of a string, in em units. */
export function measureLabelUnits(text: string): number {
  let units = 0;
  for (const char of text) units += charUnits(char);
  return units;
}

/** Hard-break a token that is too wide to fit on a line by itself. */
function hardBreak(text: string, maxUnits: number): string[] {
  if (measureLabelUnits(text) <= maxUnits) return [text];
  const pieces: string[] = [];
  let current = "";
  let units = 0;
  for (const char of text) {
    const width = charUnits(char);
    if (current && units + width > maxUnits) {
      pieces.push(current);
      current = char;
      units = width;
    } else {
      current += char;
      units += width;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/** Wrap a label into lines no wider than `maxUnits`, preferring space breaks. */
export function wrapLabel(label: string, maxUnits = RADAR_LABEL_MAX_LINE_UNITS): string[] {
  if (measureLabelUnits(label) <= maxUnits) return [label];
  const lines: string[] = [];
  let current = "";
  for (const word of label.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && measureLabelUnits(candidate) > maxUnits) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.flatMap((line) => hardBreak(line, maxUnits));
}

/** Angle of an axis in radians: starts at the top and runs clockwise. */
export function radarAngle(index: number, count: number): number {
  return (Math.PI * 2 * index) / count - Math.PI / 2;
}

/**
 * Lay out a radar chart: the largest plotted radius whose axis labels still fit
 * inside a `size` x `size` box, plus each label's anchor point.
 *
 * A label sits `radius x RADAR_LABEL_SCALE` from the centre, so its box reaches
 * `radius x RADAR_LABEL_SCALE x |cos| + halfWidth` horizontally and
 * `radius x RADAR_LABEL_SCALE x |sin| + halfHeight` vertically. The tightest
 * constraint across all axes wins.
 */
export function radarLayout(labels: string[], size: number): RadarLayout {
  const center = size / 2;
  const count = labels.length;
  const lines = labels.map((label) => wrapLabel(label));

  let radius = center - RADAR_LABEL_RADIUS_INSET;
  for (let index = 0; index < count; index += 1) {
    const angle = radarAngle(index, count);
    const horizontal = Math.abs(Math.cos(angle));
    const vertical = Math.abs(Math.sin(angle));
    const halfWidth = (Math.max(...lines[index].map(measureLabelUnits)) * RADAR_LABEL_FONT_SIZE) / 2;
    const halfHeight = (lines[index].length * RADAR_LABEL_FONT_SIZE * RADAR_LABEL_LINE_HEIGHT) / 2;
    if (horizontal > 1e-6) {
      radius = Math.min(
        radius,
        (center - RADAR_LABEL_PADDING - halfWidth) / (RADAR_LABEL_SCALE * horizontal)
      );
    }
    if (vertical > 1e-6) {
      radius = Math.min(
        radius,
        (center - RADAR_LABEL_PADDING - halfHeight) / (RADAR_LABEL_SCALE * vertical)
      );
    }
  }

  const plottedRadius = Math.max(radius, 8);

  return {
    center,
    radius: plottedRadius,
    labels: lines.map((labelLines, index) => {
      const angle = radarAngle(index, count);
      const anchorRadius = plottedRadius * RADAR_LABEL_SCALE;
      return {
        lines: labelLines,
        x: center + Math.cos(angle) * anchorRadius,
        y: center + Math.sin(angle) * anchorRadius,
        halfWidth: (Math.max(...labelLines.map(measureLabelUnits)) * RADAR_LABEL_FONT_SIZE) / 2,
        halfHeight: (labelLines.length * RADAR_LABEL_FONT_SIZE * RADAR_LABEL_LINE_HEIGHT) / 2,
      };
    }),
  };
}
