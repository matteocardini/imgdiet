import type { Dimensions, ImageFormat } from "./types.js";

/**
 * Reads format and size from the first bytes of a file, with no dependencies.
 * Only the headers are needed, so the fetcher can stop after a few kilobytes.
 */
export function readFormat(buf: Uint8Array): ImageFormat {
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...buf.subarray(start, start + length));

  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && ascii(1, 3) === "PNG") return "png";
  if (buf.length >= 6 && ascii(0, 3) === "GIF") return "gif";
  if (buf.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "webp";
  if (buf.length >= 12 && ascii(4, 4) === "ftyp" && /avif|avis/.test(ascii(8, 4))) return "avif";
  if (/^\s*(<\?xml|<svg)/i.test(ascii(0, 60))) return "svg";
  return "unknown";
}

export function readDimensions(buf: Uint8Array, format: ImageFormat): Dimensions | undefined {
  switch (format) {
    case "png":
      return buf.length >= 24 ? { width: be32(buf, 16), height: be32(buf, 20) } : undefined;
    case "gif":
      return buf.length >= 10 ? { width: le16(buf, 6), height: le16(buf, 8) } : undefined;
    case "jpeg":
      return jpeg(buf);
    case "webp":
      return webp(buf);
    default:
      return undefined;
  }
}

const be32 = (b: Uint8Array, i: number) => (b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3];
const be16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const le16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const le24 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);

/** Walks the JPEG markers until a start-of-frame segment carries the size. */
function jpeg(buf: Uint8Array): Dimensions | undefined {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    // SOF0..SOF15, minus the markers that are not frames.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: be16(buf, i + 5), width: be16(buf, i + 7) };
    }
    i += 2 + be16(buf, i + 2);
  }
  return undefined;
}

function webp(buf: Uint8Array): Dimensions | undefined {
  const tag = String.fromCharCode(...buf.subarray(12, 16));
  if (tag === "VP8X" && buf.length >= 30) {
    return { width: le24(buf, 24) + 1, height: le24(buf, 27) + 1 };
  }
  if (tag === "VP8L" && buf.length >= 25) {
    const bits = buf[21] | (buf[22] << 8) | (buf[23] << 16) | (buf[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (tag === "VP8 " && buf.length >= 30) {
    return { width: le16(buf, 26) & 0x3fff, height: le16(buf, 28) & 0x3fff };
  }
  return undefined;
}
