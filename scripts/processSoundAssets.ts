import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  stat as statFile,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, join, relative } from "node:path";

const ensureDir = (dir: string) => mkdir(dir, { recursive: true });

type Category = "sfx" | "music" | "ambience";

export type ProcessOptions = {
  inputDir?: string;
  outputDir?: string;
  targets?: ("opus" | "mp3")[];
  longThresholdSec?: number;
  keepTree?: boolean;
  cacheFileName?: string;
  verbose?: boolean;
  preferCli?: boolean; // prefer native ffmpeg when available
  // encoding params
  opusBitrateSfx?: number;
  opusBitrateLong?: number;
  mp3Quality?: number; // libmp3lame VBR q (0 best .. 9 worst)
};

type CacheEntry = {
  sourceHash: string;
  optionsHash: string;
  mtimeMs: number;
  size: number;
  outputs: Record<string, { mtimeMs: number; size: number }>;
};
type CacheManifest = { version: 1; entries: Record<string, CacheEntry> };

const DEFAULTS: Required<
  Pick<
    ProcessOptions,
    | "inputDir"
    | "outputDir"
    | "targets"
    | "longThresholdSec"
    | "keepTree"
    | "cacheFileName"
    | "verbose"
    | "preferCli"
    | "opusBitrateSfx"
    | "opusBitrateLong"
    | "mp3Quality"
  >
> = {
  inputDir: "client/assets",
  outputDir: "dist/assets",
  targets: ["opus"],
  longThresholdSec: 30,
  keepTree: false,
  cacheFileName: ".audio-cache.json",
  verbose: false,
  preferCli: true,
  opusBitrateSfx: 96_000,
  opusBitrateLong: 128_000,
  mp3Quality: 2,
};

export async function processSoundAssets(opts: ProcessOptions = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  await ensureDir(cfg.outputDir);
  const cachePath = join(cfg.outputDir, cfg.cacheFileName);
  const cache = await loadCache(cachePath);

  const files: string[] = [];
  const entries = await readdir(cfg.inputDir, {
    recursive: true,
    withFileTypes: true,
  });
  for (const entry of entries) {
    const path = join(entry.parentPath, entry.name);
    if (entry.isFile() && AUDIO_EXTS.has(extname(path).toLowerCase())) {
      files.push(path);
    }
  }

  let encoded = 0, skipped = 0;
  let ffmpegPath: string | null = null;
  let runner: Runner | null = null;

  const concurrencyLimit = 8;

  // Process files in batches
  const processFile = async (abs: string) => {
    const rel = relative(cfg.inputDir, abs);
    const stat = await statFile(abs);
    const srcHash = await sha256File(abs);

    // classify
    let category = guessCategoryByPath(rel);
    if (!category) category = "sfx";

    const optionsHash = await sha256String(JSON.stringify({
      targets: cfg.targets,
      category,
      opusBitrate: category === "sfx"
        ? cfg.opusBitrateSfx
        : cfg.opusBitrateLong,
      mp3Quality: cfg.mp3Quality,
      longThresholdSec: cfg.longThresholdSec,
      filtersVersion: 3, // bump if you change the filter graph below
      engine: "cli",
    }));

    const key = rel.replaceAll("\\", "/");
    const prev = cache.entries[key];

    const shouldSkip = prev &&
      prev.sourceHash === srcHash &&
      prev.optionsHash === optionsHash &&
      cfg.targets.every((t) =>
        prev.outputs[t] && existsSync(outPath(cfg, rel, t))
      );

    if (shouldSkip) {
      skipped++;
      if (cfg.verbose) console.log(`SKIP ${rel}`);
      return;
    }

    // Lazy initialize ffmpeg only when we need to encode a file
    if (!runner) {
      const ffmpegInfo = await findFFmpeg(cfg);
      ffmpegPath = ffmpegInfo.ffmpegPath;
      runner = makeCliRunner(ffmpegPath);
      if (cfg.verbose) {
        console.log(
          `Audio: ${files.length} file(s). Using ffmpeg at ${ffmpegPath}`,
        );
      }
    }

    // ensure output dir
    const outDir = cfg.keepTree
      ? join(cfg.outputDir, dirname(rel))
      : cfg.outputDir;
    await ensureDir(outDir);

    for (const target of cfg.targets) {
      const out = outPath(cfg, rel, target);
      await ensureDir(dirname(out));
      await encodeOne(runner, abs, out, {
        target,
        category,
        opusBitrate: category === "sfx"
          ? cfg.opusBitrateSfx
          : cfg.opusBitrateLong,
        mp3Quality: cfg.mp3Quality,
      }, cfg.verbose);
    }

    // update cache
    const outputs: CacheEntry["outputs"] = {};
    for (const t of cfg.targets) {
      const st = await statFile(outPath(cfg, rel, t));
      outputs[t] = { mtimeMs: st.mtime?.getTime() ?? 0, size: st.size };
    }
    cache.entries[key] = {
      sourceHash: srcHash,
      optionsHash,
      mtimeMs: stat.mtime?.getTime() ?? 0,
      size: stat.size,
      outputs,
    };
    encoded++;
    if (cfg.verbose) console.log(`DONE ${rel}`);
  };

  // Process files in parallel with concurrency limit
  const promises: Promise<void>[] = [];
  for (const abs of files) {
    // Start processing immediately
    const promise = processFile(abs);
    promises.push(promise);

    // If we've reached the concurrency limit, wait for one to complete
    if (promises.length >= concurrencyLimit) {
      await Promise.race(promises);
      // Remove completed promises
      for (let i = promises.length - 1; i >= 0; i--) {
        if (
          await Promise.race([promises[i], Promise.resolve("pending")]) !==
            "pending"
        ) {
          promises.splice(i, 1);
        }
      }
    }
  }

  // Wait for all remaining promises to complete
  await Promise.all(promises);

  await saveCache(cachePath, cache);
  console.log(`[Build] ${encoded} encoded, ${skipped} up-to-date.`);
}

// ---------------- internals ----------------

async function findFFmpeg(
  cfg: Required<ProcessOptions>,
): Promise<{ ffmpegPath: string; haveFfprobe: boolean }> {
  if (cfg.preferCli && await isCmdAvailable("ffmpeg")) {
    return {
      ffmpegPath: "ffmpeg",
      haveFfprobe: await isCmdAvailable("ffprobe"),
    };
  }

  throw new Error(
    "FFmpeg not found. Please install FFmpeg or ensure it's available in your PATH.",
  );
}

/** Runs `cmd`, resolving with its exit code; rejects if it cannot start. */
const run = (cmd: string, args: string[], stdio: "inherit" | "ignore") =>
  new Promise<number>((resolve, reject) =>
    spawn(cmd, args, { stdio })
      .on("error", reject)
      .on("close", (code) => resolve(code ?? 1))
  );

const AUDIO_EXTS = new Set([
  ".wav",
  ".wave",
  ".flac",
  ".mp3",
  ".m4a",
  ".aac",
  ".ogg",
  ".opus",
]);

// Runner abstraction
type Runner = {
  runOnDisk: (args: string[]) => Promise<void>;
  supportsLoudnorm: () => Promise<boolean>;
};

function makeCliRunner(ffmpegPath = "ffmpeg"): Runner {
  return {
    runOnDisk: async (args: string[]) => {
      const code = await run(ffmpegPath, args, "inherit");
      if (code !== 0) throw new Error(`ffmpeg failed (${code})`);
    },
    supportsLoudnorm: () => Promise.resolve(true),
  };
}

function outPath(
  cfg:
    & Required<Pick<ProcessOptions, "outputDir" | "keepTree">>
    & ProcessOptions,
  rel: string,
  ext: "opus" | "mp3",
) {
  const base = rel.replace(/\.[^.]+$/, "");
  const sub = cfg.keepTree ? base : basename(base);
  return join(cfg.outputDir, sub + "." + ext);
}

function guessCategoryByPath(rel: string): Category | null {
  const p = rel.toLowerCase();
  if (p.includes("/music/") || p.includes("\\music\\") || /\bbgm\b/.test(p)) {
    return "music";
  }
  if (p.includes("/amb") || p.includes("/ambience") || p.includes("/ambient")) {
    return "ambience";
  }
  if (p.includes("/ui/")) return "sfx";
  if (p.includes("/sfx/") || p.includes("/fx/")) return "sfx";
  return null;
}

async function encodeOne(
  runner: Runner,
  inputPath: string,
  outputPath: string,
  opts: {
    target: "opus" | "mp3";
    category: Category;
    opusBitrate: number;
    mp3Quality: number;
  },
  verbose: boolean,
) {
  // Build filter chain
  const wantLoudnorm = opts.category !== "sfx";
  const canLoudnorm = wantLoudnorm ? await runner.supportsLoudnorm() : false;

  let af = "";
  if (opts.category === "sfx") {
    // 0.891 is equal to -1dB
    af = "alimiter=limit=0.891";
  } else if (canLoudnorm) {
    af = "loudnorm=I=-18:TP=-1.0:LRA=11";
  } else {
    // wasm fallback if loudnorm missing: gentle compressor + limiter
    af =
      "acompressor=threshold=-18dB:ratio=3:attack=10:release=200,alimiter=limit=0.891";
  }

  // Codec args
  const codecArgs = opts.target === "opus"
    ? [
      "-c:a",
      "libopus",
      "-b:a",
      String(opts.opusBitrate),
      "-vbr",
      "on",
      "-compression_level",
      "10",
      "-ar",
      "48000",
    ]
    : ["-c:a", "libmp3lame", "-q:a", String(opts.mp3Quality)];

  const args = [
    "-y",
    "-v",
    "warning",
    "-i",
    inputPath,
    "-vn",
    ...(opts.category === "sfx" ? ["-ac", "1"] : []),
    "-af",
    af,
    ...codecArgs,
    outputPath,
  ];
  if (verbose) console.log(`ffmpeg ${args.join(" ")}`);
  await runner.runOnDisk(args);
}

async function isCmdAvailable(cmd: string): Promise<boolean> {
  try {
    return await run(cmd, ["-version"], "ignore") === 0;
  } catch {
    return false;
  }
}

// ---- hashing & cache I/O ----
async function sha256File(path: string): Promise<string> {
  const data = await readFile(path);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return hex(new Uint8Array(hash));
}
async function sha256String(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return hex(new Uint8Array(hash));
}
function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function loadCache(path: string): Promise<CacheManifest> {
  try {
    const data = await readFile(path, "utf8");
    const json = JSON.parse(data) as CacheManifest;
    if (json.version !== 1 || !json.entries) throw new Error("bad cache");
    return json;
  } catch {
    return { version: 1, entries: {} };
  }
}
async function saveCache(path: string, cache: CacheManifest): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, JSON.stringify(cache, null, 2));
}

if (import.meta.main) await processSoundAssets();
