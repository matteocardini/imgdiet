import { kb } from "./analyze.js";
import type { ImageReport, Report } from "./types.js";

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
};

const MARK = { error: "✕", warning: "!", notice: "·" } as const;
const COLOR = { error: ANSI.red, warning: ANSI.yellow, notice: ANSI.dim } as const;

export function buildReport(source: string, images: ImageReport[], failed: Report["failed"]): Report {
  return {
    source,
    images: [...images].sort((a, b) => b.saving - a.saving || b.bytes - a.bytes),
    totalBytes: images.reduce((n, i) => n + i.bytes, 0),
    totalSaving: images.reduce((n, i) => n + i.saving, 0),
    failed,
  };
}

export function formatReport(report: Report, { color = true, top = 10 } = {}): string {
  const c = (code: string, text: string) => (color ? `${code}${text}${ANSI.reset}` : text);
  const lines = ["", c(ANSI.bold, report.source), ""];

  if (!report.images.length) {
    lines.push("No images found.", "");
    return lines.join("\n");
  }

  const worst = report.images.filter((i) => i.findings.length).slice(0, top);

  for (const image of worst) {
    const head = `${name(image)} ${c(ANSI.dim, `${kb(image.bytes)}${size(image)}`)}`;
    lines.push(head);
    for (const finding of image.findings) {
      const saving = finding.saving > 0 ? c(ANSI.dim, `  (−${kb(finding.saving)})`) : "";
      lines.push(`  ${c(COLOR[finding.level], MARK[finding.level])} ${finding.detail}${saving}`);
    }
    lines.push("");
  }

  const hidden = report.images.filter((i) => i.findings.length).length - worst.length;
  if (hidden > 0) {
    lines.push(c(ANSI.dim, `…and ${hidden} more with something to fix. Use --top ${hidden + top} to see them.`), "");
  }

  const percent = report.totalBytes ? Math.round((report.totalSaving / report.totalBytes) * 100) : 0;
  lines.push(
    `${report.images.length} images, ${c(ANSI.bold, kb(report.totalBytes))} in total.`,
    report.totalSaving > 0
      ? `Could lose about ${c(ANSI.bold, kb(report.totalSaving))} (${percent}%) by resizing and converting.`
      : c(ANSI.green, "Nothing worth changing. These images are in good shape.")
  );

  if (report.failed.length) {
    lines.push(c(ANSI.dim, `${report.failed.length} image(s) could not be read.`));
  }
  lines.push("");
  return lines.join("\n");
}

function name(image: ImageReport): string {
  const parts = image.src.split("/");
  return parts[parts.length - 1] || image.src;
}

function size(image: ImageReport): string {
  return image.dimensions ? `, ${image.dimensions.width}×${image.dimensions.height}` : "";
}
