import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { serveFile } from "./serveFile.ts";

let dir: string;
let file: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "serveFile-"));
  file = join(dir, "clip.opus");
  await writeFile(file, "0123456789");
});

afterAll(() => rm(dir, { recursive: true }));

const get = (headers: Record<string, string> = {}) =>
  serveFile(new Request("http://localhost/clip.opus", { headers }), file);

it("serves the file with its content type", async () => {
  const response = await get();
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("audio/ogg");
  expect(response.headers.get("content-length")).toBe("10");
  expect(await response.text()).toBe("0123456789");
});

it("answers a matching etag with 304", async () => {
  const etag = (await get()).headers.get("etag")!;
  const response = await get({ "if-none-match": etag });
  expect(response.status).toBe(304);
  expect(response.body).toBeNull();
});

it("serves a byte range", async () => {
  const response = await get({ range: "bytes=2-5" });
  expect(response.status).toBe(206);
  expect(response.headers.get("content-range")).toBe("bytes 2-5/10");
  expect(await response.text()).toBe("2345");
});

it("serves an open-ended and a suffix range", async () => {
  expect(await (await get({ range: "bytes=7-" })).text()).toBe("789");
  expect(await (await get({ range: "bytes=-3" })).text()).toBe("789");
});

it("rejects a range past the end", async () => {
  const response = await get({ range: "bytes=20-30" });
  expect(response.status).toBe(416);
  expect(response.headers.get("content-range")).toBe("bytes */10");
});

it("answers a missing file with 404", async () => {
  const response = await serveFile(
    new Request("http://localhost/missing"),
    join(dir, "missing"),
  );
  expect(response.status).toBe(404);
});
