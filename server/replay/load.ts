import { readFile } from "node:fs/promises";
import { parseReplay, type Replay } from "./format.ts";

/** Reads a replay file, gzipped (`.gz`) or plain. */
export const loadReplay = async (path: string | URL): Promise<Replay> => {
  const file = new Blob([new Uint8Array(await readFile(path))]);
  const stream = String(path).endsWith(".gz")
    ? file.stream().pipeThrough(new DecompressionStream("gzip"))
    : file.stream();
  return parseReplay(await new Response(stream).text());
};
