import type { Finding, ImageFacts, ImageReport } from "./types.js";

export interface Budget {
  /** Bytes above which a single image is worth a look. */
  heavy: number;
  /** Bytes above which it is a real problem. */
  veryHeavy: number;
  /** Widest an image should ever be when the page does not say. */
  maxWidth: number;
  /** How much a device pixel ratio of 2 is allowed to multiply the display width. */
  dpr: number;
}

export const defaultBudget: Budget = {
  heavy: 200 * 1024,
  veryHeavy: 600 * 1024,
  maxWidth: 1800,
  dpr: 2,
};

/** Rough, honest ratios: what the same picture usually weighs in a modern format. */
const FORMAT_SAVING: Record<string, number> = { jpeg: 0.3, png: 0.5, gif: 0.7 };

export function analyze(image: ImageFacts, budget: Budget = defaultBudget): ImageReport {
  const findings: Finding[] = [];
  const { bytes, format, dimensions } = image;

  // 1. Serving more pixels than the layout can use: the biggest win, so it comes first.
  const allowedWidth = image.displayWidth ? image.displayWidth * budget.dpr : budget.maxWidth;
  let resizeSaving = 0;
  if (dimensions && dimensions.width > allowedWidth * 1.15) {
    const ratio = (allowedWidth / dimensions.width) ** 2;
    resizeSaving = Math.round(bytes * (1 - ratio));
    findings.push({
      code: "oversized",
      level: bytes > budget.heavy ? "error" : "warning",
      detail: `${dimensions.width}px wide, shown at most at ${Math.round(allowedWidth)}px`,
      saving: resizeSaving,
    });
  }

  // 2. Old format, applied to whatever would be left after resizing.
  const formatRatio = FORMAT_SAVING[format];
  if (formatRatio) {
    const remaining = bytes - resizeSaving;
    findings.push({
      code: "old-format",
      level: "warning",
      detail: `${format.toUpperCase()} could be WebP or AVIF`,
      saving: Math.round(remaining * formatRatio),
    });
  }

  if (format === "png" && dimensions && dimensions.width * dimensions.height > 250_000 && bytes > budget.heavy) {
    findings.push({
      code: "png-photo",
      level: "warning",
      detail: "Large PNG: photos belong in JPEG, WebP or AVIF",
      saving: 0,
    });
  }

  if (bytes > budget.veryHeavy) {
    findings.push({
      code: "heavy",
      level: "error",
      detail: `${kb(bytes)} for one image`,
      saving: 0,
    });
  } else if (bytes > budget.heavy) {
    findings.push({ code: "heavy", level: "warning", detail: kb(bytes), saving: 0 });
  }

  if (image.missingSize) {
    findings.push({
      code: "no-dimensions",
      level: "notice",
      detail: "No width and height in the markup, so the page jumps while loading",
      saving: 0,
    });
  }

  const saving = Math.min(
    bytes,
    findings.reduce((total, f) => total + f.saving, 0)
  );

  return { ...image, findings, saving };
}

export function kb(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} kB`;
}
