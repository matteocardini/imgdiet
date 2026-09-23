import type { ImageRef } from "./types.js";

/**
 * Pulls every image a page asks the browser to download: img, picture sources,
 * and the social preview image. Pure, so it is easy to test.
 */
export function findImages(html: string, pageUrl: string): ImageRef[] {
  const found = new Map<string, ImageRef>();

  const add = (raw: string, ref: Omit<ImageRef, "src">) => {
    const src = absolute(raw, pageUrl);
    if (!src || src.startsWith("data:")) return;
    const existing = found.get(src);
    if (existing) {
      // Keep the largest display width we have seen for the same file.
      existing.displayWidth = Math.max(existing.displayWidth ?? 0, ref.displayWidth ?? 0) || undefined;
      existing.missingSize = existing.missingSize && ref.missingSize;
      return;
    }
    found.set(src, { src, ...ref });
  };

  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const width = Number(attr(tag, "width")) || undefined;
    const height = Number(attr(tag, "height")) || undefined;
    const sizes = attr(tag, "sizes");
    const ref = {
      displayWidth: width ?? sizesWidth(sizes),
      missingSize: !width || !height,
      lazy: attr(tag, "loading").toLowerCase() === "lazy",
    };

    const src = attr(tag, "src");
    if (src) add(src, ref);
    for (const candidate of srcsetUrls(attr(tag, "srcset"))) add(candidate, ref);
  }

  for (const tag of html.match(/<source\b[^>]*>/gi) ?? []) {
    for (const candidate of srcsetUrls(attr(tag, "srcset"))) {
      add(candidate, { displayWidth: sizesWidth(attr(tag, "sizes")), missingSize: false });
    }
  }

  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]*>/i)?.[0];
  if (og) add(attr(og, "content"), { displayWidth: 1200, missingSize: false });

  return [...found.values()];
}

function attr(tag: string, name: string): string {
  const double = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"));
  if (double) return double[1].trim();
  const single = tag.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i"));
  if (single) return single[1].trim();
  const bare = tag.match(new RegExp(`\\b${name}\\s*=\\s*([^\\s>]+)`, "i"));
  return bare ? bare[1].trim() : "";
}

function srcsetUrls(value: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

/** Takes the largest pixel width a sizes attribute can resolve to. */
function sizesWidth(value: string): number | undefined {
  if (!value) return undefined;
  const widths = [...value.matchAll(/(\d+)px/g)].map((m) => Number(m[1]));
  return widths.length ? Math.max(...widths) : undefined;
}

function absolute(raw: string, base: string): string {
  try {
    return new URL(raw, base).toString();
  } catch {
    return "";
  }
}
