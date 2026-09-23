import { describe, expect, it } from "vitest";
import { analyze, defaultBudget } from "./analyze";
import type { ImageFacts } from "./types";

const image = (over: Partial<ImageFacts> = {}): ImageFacts => ({
  src: "https://example.com/hero.jpg",
  bytes: 120 * 1024,
  format: "jpeg",
  dimensions: { width: 1200, height: 800 },
  displayWidth: 600,
  missingSize: false,
  ...over,
});

const codes = (facts: ImageFacts) => analyze(facts).findings.map((f) => f.code);

describe("analyze", () => {
  it("leaves a well sized modern image alone", () => {
    expect(codes(image({ format: "avif", bytes: 40 * 1024 }))).toEqual([]);
  });

  it("flags an image far wider than the layout uses", () => {
    const report = analyze(image({ dimensions: { width: 4000, height: 3000 }, bytes: 900 * 1024 }));
    expect(report.findings[0].code).toBe("oversized");
    expect(report.findings[0].saving).toBeGreaterThan(700 * 1024);
  });

  it("allows twice the display width for retina screens", () => {
    expect(codes(image({ dimensions: { width: 1200, height: 800 }, displayWidth: 600 }))).not.toContain("oversized");
  });

  it("falls back to a maximum width when the page does not say", () => {
    expect(codes(image({ displayWidth: undefined, dimensions: { width: 3000, height: 2000 } }))).toContain("oversized");
  });

  it("suggests a modern format for JPEG and PNG but not for WebP", () => {
    expect(codes(image())).toContain("old-format");
    expect(codes(image({ format: "webp" }))).not.toContain("old-format");
  });

  it("never estimates a saving larger than the file", () => {
    const report = analyze(image({ bytes: 500 * 1024, dimensions: { width: 5000, height: 4000 } }));
    expect(report.saving).toBeLessThanOrEqual(500 * 1024);
  });

  it("does not count the same bytes twice when resizing and converting", () => {
    const report = analyze(image({ bytes: 1000 * 1024, dimensions: { width: 2400, height: 1600 } }));
    const naive = report.findings.reduce((n, f) => n + f.saving, 0);
    expect(report.saving).toBe(Math.min(1000 * 1024, naive));
    expect(report.saving).toBeLessThan(1000 * 1024);
  });

  it("calls out a very heavy file as an error", () => {
    const report = analyze(image({ bytes: 2 * 1024 * 1024, format: "webp", dimensions: { width: 1200, height: 800 } }));
    expect(report.findings.find((f) => f.code === "heavy")?.level).toBe("error");
  });

  it("flags a big PNG that should be a photo format", () => {
    expect(codes(image({ format: "png", bytes: 800 * 1024 }))).toContain("png-photo");
  });

  it("mentions missing markup dimensions as a notice", () => {
    const report = analyze(image({ missingSize: true }));
    expect(report.findings.find((f) => f.code === "no-dimensions")?.level).toBe("notice");
  });

  it("respects a custom budget", () => {
    const strict = analyze(image({ bytes: 120 * 1024, format: "webp" }), { ...defaultBudget, heavy: 50 * 1024 });
    expect(strict.findings.map((f) => f.code)).toContain("heavy");
  });
});
