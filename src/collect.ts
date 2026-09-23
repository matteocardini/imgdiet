import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { readDimensions, readFormat } from "./dimensions.js";
import { findImages } from "./html.js";
import type { ImageFacts, ImageRef } from "./types.js";

const UA = "imgdiet (+https://github.com/matteocardini/imgdiet)";
const HEADER_BYTES = 64 * 1024;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg"]);

export class CollectError extends Error {}

export interface Collected {
  source: string;
  images: ImageFacts[];
  failed: { src: string; reason: string }[];
}

export async function fromUrl(input: string, concurrency = 6): Promise<Collected> {
  const url = normalizeUrl(input);
  const page = await fetchText(url);
  const refs = findImages(page.html, page.url);

  const images: ImageFacts[] = [];
  const failed: { src: string; reason: string }[] = [];

  await pool(refs, concurrency, async (ref) => {
    try {
      images.push(await fetchImage(ref));
    } catch (error) {
      failed.push({ src: ref.src, reason: (error as Error).message });
    }
  });

  return { source: page.url, images, failed };
}

export async function fromFolder(path: string): Promise<Collected> {
  const root = resolve(path);
  const files = await walk(root);
  const images: ImageFacts[] = [];
  const failed: { src: string; reason: string }[] = [];

  for (const file of files) {
    try {
      const [info, head] = await Promise.all([stat(file), readHead(file)]);
      const format = readFormat(head);
      images.push({
        src: relative(root, file),
        bytes: info.size,
        format,
        dimensions: readDimensions(head, format),
      });
    } catch (error) {
      failed.push({ src: relative(root, file), reason: (error as Error).message });
    }
  }

  return { source: root, images, failed };
}

export function normalizeUrl(input: string): string {
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    throw new CollectError(`"${input}" is not a valid URL.`);
  }
}

async function fetchText(url: string) {
  const res = await request(url);
  if (!res.ok) throw new CollectError(`The page answered with status ${res.status}.`);
  return { url: res.url || url, html: await res.text() };
}

/** Downloads only what the header parser needs, then drops the connection. */
async function fetchImage(ref: ImageRef): Promise<ImageFacts> {
  const res = await request(ref.src);
  if (!res.ok) throw new CollectError(`status ${res.status}`);

  const declared = Number(res.headers.get("content-length")) || 0;
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let head: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  let bytes = 0;

  const reader = res.body?.getReader();
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (head.length < HEADER_BYTES) chunks.push(value as Uint8Array<ArrayBuffer>);
      if (declared && head.length >= HEADER_BYTES) {
        await reader.cancel();
        break;
      }
      if (chunks.length && head.length < HEADER_BYTES) head = concat(chunks);
    }
  }
  if (!head.length && chunks.length) head = concat(chunks);

  const format = readFormat(head);
  return {
    ...ref,
    bytes: declared || bytes,
    format,
    dimensions: readDimensions(head, format),
  };
}

async function request(url: string): Promise<Response> {
  try {
    return await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? "timed out" : "request failed";
    throw new CollectError(reason);
  }
}

function concat(chunks: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function readHead(file: string): Promise<Uint8Array<ArrayBuffer>> {
  const buffer = await readFile(file);
  const head = new Uint8Array(Math.min(buffer.length, HEADER_BYTES));
  head.set(buffer.subarray(0, head.length));
  return head;
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

/** Keeps a few downloads in flight without pulling in a dependency. */
async function pool<T>(items: T[], size: number, worker: (item: T) => Promise<void>) {
  let index = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (index < items.length) {
      await worker(items[index++]);
    }
  });
  await Promise.all(runners);
}
