import { openAsBlob } from "node:fs";
import { stat } from "node:fs/promises";
import { extname } from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".png": "image/png",
  ".sf2": "audio/x-soundfont",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

type Range = { start: number; end: number };

/** Parses a single-range `bytes=` header; `null` if it lies outside the file. */
const parseRange = (header: string, size: number): Range | null | undefined => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return undefined;
  const [start, end] = match[1]
    ? [
      Number(match[1]),
      match[2] ? Math.min(Number(match[2]), size - 1) : size - 1,
    ]
    : [Math.max(0, size - Number(match[2])), size - 1];
  return start <= end && start < size ? { start, end } : null;
};

/**
 * Responds with the file at `path`, honoring `If-None-Match` and single byte
 * ranges. Runs on any runtime with `node:fs`.
 */
export const serveFile = async (
  req: Request,
  path: string,
): Promise<Response> => {
  const info = await stat(path).catch(() => undefined);
  if (!info?.isFile()) return new Response("Not Found", { status: 404 });

  const etag = `W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
  const headers = new Headers({
    "accept-ranges": "bytes",
    "content-type": CONTENT_TYPES[extname(path).toLowerCase()] ??
      "application/octet-stream",
    etag,
    "last-modified": info.mtime.toUTCString(),
  });

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  const blob = await openAsBlob(path);
  const rangeHeader = req.headers.get("range");
  const range = rangeHeader ? parseRange(rangeHeader, info.size) : undefined;

  if (range === null) {
    headers.set("content-range", `bytes */${info.size}`);
    return new Response(null, { status: 416, headers });
  }

  if (range) {
    headers.set(
      "content-range",
      `bytes ${range.start}-${range.end}/${info.size}`,
    );
    headers.set("content-length", String(range.end - range.start + 1));
    return new Response(blob.slice(range.start, range.end + 1), {
      status: 206,
      headers,
    });
  }

  headers.set("content-length", String(info.size));
  return new Response(blob, { headers });
};
