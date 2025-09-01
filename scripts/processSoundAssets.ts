import { ensureDir } from "jsr:@std/fs/ensure-dir";
import { walk } from "jsr:@std/fs/walk";
import { basename, dirname, extname, join, relative } from "jsr:@std/path";
import { iterateReader } from "jsr:@std/io/iterate-reader";

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
  for await (
    const entry of walk(cfg.inputDir, {
      includeFiles: true,
      includeDirs: false,
    })
  ) {
    const ext = extname(entry.path).toLowerCase();
    if (AUDIO_EXTS.has(ext)) files.push(entry.path);
  }

  let encoded = 0, skipped = 0;
  let ffmpegPath: string | null = null;
  let runner: Runner | null = null;

  // Get number of CPU cores for concurrency limit (Deno doesn't have a direct API for this)
  // Use a reasonable default based on typical systems
  const concurrencyLimit = 8; // Good balance for most systems

  // Process files in batches
  const processFile = async (abs: string) => {
    const rel = relative(cfg.inputDir, abs);
    const stat = await Deno.stat(abs);
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
      filtersVersion: 2, // bump if you change the filter graph below
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
      const st = await Deno.stat(outPath(cfg, rel, t));
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
  // Try system FFmpeg first
  if (cfg.preferCli && await isCmdAvailable("ffmpeg")) {
    return {
      ffmpegPath: "ffmpeg",
      haveFfprobe: await isCmdAvailable("ffprobe"),
    };
  }

  // Try bundled FFmpeg
  const bundledPath = await findBundledFFmpeg(cfg.verbose);
  if (bundledPath) {
    return {
      ffmpegPath: bundledPath,
      haveFfprobe: false, // Bundled version doesn't include ffprobe
    };
  }

  throw new Error(
    "FFmpeg not found. Please install FFmpeg or ensure it's available in your PATH.",
  );
}

async function findBundledFFmpeg(verbose: boolean): Promise<string | null> {
  try {
    const platform = Deno.build.os === "linux"
      ? "linux-x64"
      : Deno.build.os === "darwin"
      ? "darwin-x64"
      : Deno.build.os === "windows"
      ? "win32-x64"
      : null;

    if (!platform) return null;

    const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";
    const possiblePaths = [
      `${homeDir}/.cache/deno/npm/registry.npmjs.org/@ffmpeg-installer/linux-x64/4.1.0/ffmpeg`,
      `${homeDir}/.cache/deno/npm/registry.npmjs.org/@ffmpeg-installer/${platform}/4.1.0/ffmpeg`,
      `${homeDir}/.cache/deno/npm/registry.npmjs.org/@ffmpeg-installer/${platform}/ffmpeg`,
    ];

    for (const path of possiblePaths) {
      if (await testExecutable(path)) {
        if (verbose) {
          console.log(`Using bundled FFmpeg from: ${path}`);
        }
        return path;
      }
    }
  } catch (error) {
    if (verbose) {
      console.log(`Bundled FFmpeg search failed: ${(error as Error).message}`);
    }
  }

  return null;
}

async function testExecutable(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    const testCmd = new Deno.Command(path, {
      args: ["-version"],
      stdout: "null",
      stderr: "null",
    });
    const { code } = await testCmd.output();
    return code === 0;
  } catch {
    return false;
  }
}
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
      const cmd = new Deno.Command(ffmpegPath, {
        args,
        stdout: "inherit",
        stderr: "inherit",
      });
      const { code } = await cmd.spawn().status;
      if (code !== 0) throw new Error(`ffmpeg failed (${code})`);
    },
    supportsLoudnorm: () => Promise.resolve(true),
  };
}

function existsSync(path: string) {
  try {
    Deno.statSync(path);
    return true;
  } catch {
    return false;
  }
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
    const proc = new Deno.Command(cmd, {
      args: ["-version"],
      stdout: "null",
      stderr: "null",
    });
    const { code } = await proc.output();
    return code === 0;
  } catch {
    return false;
  }
}

// ---- hashing & cache I/O ----
async function sha256File(path: string): Promise<string> {
  const f = await Deno.open(path, { read: true });
  const chunks: Uint8Array[] = [];
  try {
    for await (const chunk of iterateReader(f)) chunks.push(chunk);
  } finally {
    f.close();
  }
  const buf = concat(chunks);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return hex(new Uint8Array(hash));
}
async function sha256String(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return hex(new Uint8Array(hash));
}
function concat(chunks: Uint8Array[]): Uint8Array {
  const len = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out;
}
function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function loadCache(path: string): Promise<CacheManifest> {
  try {
    const data = await Deno.readTextFile(path);
    const json = JSON.parse(data) as CacheManifest;
    if (json.version !== 1 || !json.entries) throw new Error("bad cache");
    return json;
  } catch {
    return { version: 1, entries: {} };
  }
}
async function saveCache(path: string, cache: CacheManifest): Promise<void> {
  await ensureDir(dirname(path));
  await Deno.writeTextFile(path, JSON.stringify(cache, null, 2));
}

if (import.meta.main) await processSoundAssets();
