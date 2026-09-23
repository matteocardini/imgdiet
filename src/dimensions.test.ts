import { describe, expect, it } from "vitest";
import { readDimensions, readFormat } from "./dimensions";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

const png = (w: number, h: number) =>
  bytes(0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...ascii("IHDR"),
    (w >> 24) & 255, (w >> 16) & 255, (w >> 8) & 255, w & 255,
    (h >> 24) & 255, (h >> 16) & 255, (h >> 8) & 255, h & 255);

const jpeg = (w: number, h: number) =>
  bytes(0xff, 0xd8, 0xff,
    0xe0, 0x00, 0x04, 0x00, 0x00,            // APP0 segment, skipped
    0xff, 0xc0, 0x00, 0x11, 0x08,            // SOF0
    (h >> 8) & 255, h & 255, (w >> 8) & 255, w & 255, 0, 0, 0);

const gif = (w: number, h: number) =>
  bytes(...ascii("GIF89a"), w & 255, (w >> 8) & 255, h & 255, (h >> 8) & 255);

const webpVp8x = (w: number, h: number) => {
  const wm = w - 1;
  const hm = h - 1;
  return bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), ...ascii("VP8X"),
    0, 0, 0, 10, 0, 0, 0, 0,
    wm & 255, (wm >> 8) & 255, (wm >> 16) & 255,
    hm & 255, (hm >> 8) & 255, (hm >> 16) & 255);
};

describe("readFormat", () => {
  it("recognises the formats a website uses", () => {
    expect(readFormat(png(1, 1))).toBe("png");
    expect(readFormat(jpeg(1, 1))).toBe("jpeg");
    expect(readFormat(gif(1, 1))).toBe("gif");
    expect(readFormat(webpVp8x(1, 1))).toBe("webp");
    expect(readFormat(bytes(...ascii('<svg xmlns="x">')))).toBe("svg");
  });

  it("says unknown rather than guessing", () => {
    expect(readFormat(bytes(1, 2, 3, 4, 5, 6, 7, 8))).toBe("unknown");
  });
});

describe("readDimensions", () => {
  it("reads PNG", () => expect(readDimensions(png(1600, 900), "png")).toEqual({ width: 1600, height: 900 }));
  it("reads JPEG past the first segment", () =>
    expect(readDimensions(jpeg(4032, 3024), "jpeg")).toEqual({ width: 4032, height: 3024 }));
  it("reads GIF", () => expect(readDimensions(gif(320, 240), "gif")).toEqual({ width: 320, height: 240 }));
  it("reads WebP VP8X", () =>
    expect(readDimensions(webpVp8x(2000, 1200), "webp")).toEqual({ width: 2000, height: 1200 }));
  it("returns undefined for a truncated header", () =>
    expect(readDimensions(bytes(0x89, 0x50), "png")).toBeUndefined());
});
