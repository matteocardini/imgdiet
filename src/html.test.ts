import { describe, expect, it } from "vitest";
import { findImages } from "./html";

const page = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`;
const at = (html: string) => findImages(html, "https://example.com/blog/post/");

describe("findImages", () => {
  it("makes relative paths absolute", () => {
    expect(at(page('<img src="../hero.jpg">'))[0].src).toBe("https://example.com/blog/hero.jpg");
  });

  it("reads the display width and spots missing dimensions", () => {
    const [withSize, without] = at(page('<img src="/a.jpg" width="400" height="300"><img src="/b.jpg">'));
    expect(withSize.displayWidth).toBe(400);
    expect(withSize.missingSize).toBe(false);
    expect(without.missingSize).toBe(true);
  });

  it("collects every candidate in a srcset", () => {
    const found = at(page('<img src="/a.jpg" srcset="/a-800.jpg 800w, /a-1600.jpg 1600w">'));
    expect(found.map((i) => i.src)).toContain("https://example.com/a-1600.jpg");
    expect(found).toHaveLength(3);
  });

  it("takes the largest width from a sizes attribute", () => {
    const [image] = at(page('<img src="/a.jpg" sizes="(max-width: 600px) 300px, 900px" srcset="/a.jpg 1x">'));
    expect(image.displayWidth).toBe(900);
  });

  it("includes picture sources", () => {
    const found = at(page('<picture><source srcset="/a.avif"><img src="/a.jpg"></picture>'));
    expect(found.map((i) => i.src)).toContain("https://example.com/a.avif");
  });

  it("includes the social preview image", () => {
    const found = findImages('<meta property="og:image" content="https://cdn.test/og.png">', "https://example.com/");
    expect(found[0].src).toBe("https://cdn.test/og.png");
  });

  it("skips inline data URIs", () => {
    expect(at(page('<img src="data:image/gif;base64,R0lGOD">'))).toHaveLength(0);
  });

  it("lists a repeated file once, keeping the largest display width", () => {
    const found = at(page('<img src="/a.jpg" width="300"><img src="/a.jpg" width="900">'));
    expect(found).toHaveLength(1);
    expect(found[0].displayWidth).toBe(900);
  });

  it("notices lazy loading", () => {
    expect(at(page('<img src="/a.jpg" loading="lazy">'))[0].lazy).toBe(true);
  });
});
