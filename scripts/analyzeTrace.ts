/**
 * Analyze a Chrome DevTools trace JSON file. Extracts per-frame timing
 * breakdown by function/category, identifies hotspots, and reports
 * frame time distribution.
 *
 * Usage: deno run --allow-read scripts/analyzeTrace.ts trace1.json
 */

const file = Deno.args[0];
if (!file) {
  console.error(
    "Usage: deno run --allow-read scripts/analyzeTrace.ts <trace.json>",
  );
  Deno.exit(1);
}

const raw = await Deno.readTextFile(file);
// Chrome traces can be either { traceEvents: [...] } or a raw array
const parsed = JSON.parse(raw);
const events: {
  name: string;
  cat: string;
  ph: string;
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
  id?: string | number;
  args?: Record<string, unknown>;
}[] = Array.isArray(parsed) ? parsed : parsed.traceEvents;

if (!events) {
  console.error("Could not find trace events in file");
  Deno.exit(1);
}

console.log(`Loaded ${events.length} events\n`);

// Find all complete events (ph=X) with duration
const completeEvents = events.filter((e) =>
  e.ph === "X" && e.dur !== undefined
);

// Aggregate by function name — total self time
const byName = new Map<string, { totalDur: number; count: number }>();
for (const e of completeEvents) {
  const existing = byName.get(e.name);
  if (existing) {
    existing.totalDur += e.dur!;
    existing.count++;
  } else {
    byName.set(e.name, { totalDur: e.dur!, count: 1 });
  }
}

// Sort by total duration descending
const sorted = [...byName.entries()].sort((a, b) =>
  b[1].totalDur - a[1].totalDur
);

console.log("=== Top 30 functions by total time ===");
console.log(
  `${"Function".padEnd(60)} ${"Total ms".padStart(10)} ${"Count".padStart(8)} ${
    "Avg ms".padStart(10)
  }`,
);
console.log("-".repeat(92));
for (const [name, data] of sorted.slice(0, 30)) {
  const totalMs = (data.totalDur / 1000).toFixed(1);
  const avgMs = (data.totalDur / data.count / 1000).toFixed(3);
  console.log(
    `${name.padEnd(60)} ${totalMs.padStart(10)} ${
      String(data.count).padStart(8)
    } ${avgMs.padStart(10)}`,
  );
}

// Frame analysis: look for RequestAnimationFrame or animation frame events
// to identify per-frame boundaries
const rafEvents = events
  .filter((e) => e.name === "FireAnimationFrame" && e.ph === "X" && e.dur)
  .sort((a, b) => a.ts - b.ts);

if (rafEvents.length > 1) {
  console.log(`\n=== Frame timing (${rafEvents.length} frames) ===`);
  const frameDurs = rafEvents.map((e) => e.dur! / 1000);
  frameDurs.sort((a, b) => a - b);
  const avg = frameDurs.reduce((a, b) => a + b, 0) / frameDurs.length;
  const p50 = frameDurs[Math.floor(frameDurs.length * 0.5)];
  const p90 = frameDurs[Math.floor(frameDurs.length * 0.9)];
  const p95 = frameDurs[Math.floor(frameDurs.length * 0.95)];
  const p99 = frameDurs[Math.floor(frameDurs.length * 0.99)];
  const max = frameDurs[frameDurs.length - 1];

  console.log(`  avg:  ${avg.toFixed(2)}ms`);
  console.log(`  p50:  ${p50.toFixed(2)}ms`);
  console.log(`  p90:  ${p90.toFixed(2)}ms`);
  console.log(`  p95:  ${p95.toFixed(2)}ms`);
  console.log(`  p99:  ${p99.toFixed(2)}ms`);
  console.log(`  max:  ${max.toFixed(2)}ms`);
  console.log(
    `  frames >4.17ms (240hz): ${
      frameDurs.filter((d) => d > 4.17).length
    }/${frameDurs.length}`,
  );
  console.log(
    `  frames >16.6ms (60hz):  ${
      frameDurs.filter((d) => d > 16.6).length
    }/${frameDurs.length}`,
  );
}

// Look for long tasks
const longTasks = completeEvents
  .filter((e) => e.dur! > 16600) // >16.6ms
  .sort((a, b) => b.dur! - a.dur!);

if (longTasks.length > 0) {
  console.log(`\n=== Long tasks (>16.6ms) — top 10 ===`);
  for (const e of longTasks.slice(0, 10)) {
    console.log(`  ${(e.dur! / 1000).toFixed(1)}ms  ${e.name}`);
  }
}

// GPU-specific: look for GPU events
const gpuEvents = completeEvents.filter((e) =>
  e.cat?.includes("gpu") || e.name.includes("GPU") || e.name.includes("Swap")
);
if (gpuEvents.length > 0) {
  console.log(`\n=== GPU events (${gpuEvents.length}) ===`);
  const gpuByName = new Map<string, { totalDur: number; count: number }>();
  for (const e of gpuEvents) {
    const existing = gpuByName.get(e.name);
    if (existing) {
      existing.totalDur += e.dur!;
      existing.count++;
    } else {
      gpuByName.set(e.name, { totalDur: e.dur!, count: 1 });
    }
  }
  for (
    const [name, data] of [...gpuByName.entries()].sort((a, b) =>
      b[1].totalDur - a[1].totalDur
    ).slice(0, 10)
  ) {
    console.log(
      `  ${name}: ${
        (data.totalDur / 1000).toFixed(1)
      }ms total, ${data.count} calls, ${
        (data.totalDur / data.count / 1000).toFixed(3)
      }ms avg`,
    );
  }
}

// JS-specific: filter to just JavaScript execution
const jsEvents = completeEvents.filter((e) =>
  e.cat?.includes("devtools.timeline") &&
  (e.name === "FunctionCall" || e.name === "EvaluateScript" ||
    e.name === "v8.compile")
);
if (jsEvents.length > 0) {
  const totalJs = jsEvents.reduce((s, e) => s + e.dur!, 0) / 1000;
  console.log(
    `\n=== JS execution: ${
      totalJs.toFixed(1)
    }ms total across ${jsEvents.length} events ===`,
  );
}

// V8 CPU profile: ProfileChunk events embed sampled call stacks per thread.
// IMPORTANT: ProfileNode ids are unique within a single profile (one per
// thread), NOT across profiles. Merging chunks across threads silently
// collides ids and produces garbage numbers. Always group by (pid, profile id)
// before resolving samples.
type CallFrame = {
  functionName: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  scriptId?: number | string;
  codeType?: string;
};
type ProfileNode = { id: number; parent?: number; callFrame: CallFrame };

const profileEvents = events.filter((e) => e.name === "Profile");
const profileChunks = events.filter((e) =>
  e.name === "ProfileChunk" && e.args && (e.args as { data?: unknown }).data
);

const threadNames = new Map<string, string>();
for (const e of events) {
  if (e.name !== "thread_name") continue;
  const name = (e.args as { name?: string } | undefined)?.name;
  if (name) threadNames.set(`${e.pid}/${e.tid}`, name);
}

const analyzeProfile = (
  threadLabel: string,
  pid: number,
  profileId: string | number,
) => {
  const myChunks = profileChunks.filter((c) =>
    c.pid === pid &&
    (c as unknown as { id?: string | number }).id === profileId
  );
  if (myChunks.length === 0) return;

  const nodes = new Map<number, ProfileNode>();
  const samples: number[] = [];
  const deltas: number[] = [];

  for (const c of myChunks) {
    const cpu = (c.args as {
      data: {
        cpuProfile?: { nodes?: ProfileNode[]; samples?: number[] };
        timeDeltas?: number[];
      };
    }).data.cpuProfile;
    if (cpu?.nodes) { for (const n of cpu.nodes) nodes.set(n.id, n); }
    if (cpu?.samples) samples.push(...cpu.samples);
    const td = (c.args as { data: { timeDeltas?: number[] } }).data.timeDeltas;
    if (td) deltas.push(...td);
  }

  // Self time per node id (leaf credit).
  const selfTime = new Map<number, number>();
  // Total/inclusive time per node id (leaf + every ancestor).
  const totalTime = new Map<number, number>();

  // Cache of resolved ancestor chain per node id, computed lazily.
  const ancestorsCache = new Map<number, number[]>();
  const resolveAncestors = (id: number): number[] => {
    const cached = ancestorsCache.get(id);
    if (cached) return cached;
    const chain: number[] = [];
    let cur: number | undefined = id;
    while (cur !== undefined) {
      chain.push(cur);
      const node = nodes.get(cur);
      cur = node?.parent;
    }
    ancestorsCache.set(id, chain);
    return chain;
  };

  const sampleCount = Math.min(samples.length, deltas.length);
  let totalSampleTime = 0;
  for (let i = 0; i < sampleCount; i++) {
    const id = samples[i];
    const dt = deltas[i];
    if (dt <= 0) continue;
    totalSampleTime += dt;
    selfTime.set(id, (selfTime.get(id) ?? 0) + dt);
    for (const a of resolveAncestors(id)) {
      totalTime.set(a, (totalTime.get(a) ?? 0) + dt);
    }
  }

  // Aggregate by callFrame identity (function + url + line) so multiple
  // node ids for the same function are merged.
  type Bucket = { self: number; total: number; count: number; key: string };
  const buckets = new Map<string, Bucket>();
  const formatKey = (cf: CallFrame): string => {
    const fn = cf.functionName || "(anonymous)";
    if (cf.url) {
      const short = cf.url.replace(/^https?:\/\/[^/]+\//, "").replace(
        /\?.*$/,
        "",
      );
      return `${fn} @ ${short}:${cf.lineNumber ?? "?"}`;
    }
    return `${fn} [${cf.codeType ?? "?"}]`;
  };

  for (const [id, node] of nodes) {
    const key = formatKey(node.callFrame);
    let b = buckets.get(key);
    if (!b) {
      b = { self: 0, total: 0, count: 0, key };
      buckets.set(key, b);
    }
    b.self += selfTime.get(id) ?? 0;
    b.total += totalTime.get(id) ?? 0;
    b.count++;
  }

  const idleTime = [...nodes.values()]
    .filter((n) =>
      n.callFrame.functionName === "(idle)" ||
      n.callFrame.functionName === "(program)"
    )
    .reduce((s, n) => s + (selfTime.get(n.id) ?? 0), 0);
  const totalSampleMs = totalSampleTime / 1000;
  const activeMs = (totalSampleTime - idleTime) / 1000;
  console.log(
    `\n=== ${threadLabel} — total=${totalSampleMs.toFixed(1)}ms active=${
      activeMs.toFixed(1)
    }ms idle=${(idleTime / 1000).toFixed(1)}ms (${sampleCount} samples) ===`,
  );

  const sortBySelf = [...buckets.values()].sort((a, b) => b.self - a.self);
  console.log("\n--- Top 30 by SELF time (where time was actually spent) ---");
  console.log(
    `${"Function".padEnd(70)} ${"Self ms".padStart(10)} ${
      "Self %".padStart(8)
    } ${"Total ms".padStart(10)}`,
  );
  console.log("-".repeat(102));
  for (const b of sortBySelf.slice(0, 30)) {
    if (b.self === 0) break;
    const selfMs = (b.self / 1000).toFixed(1);
    const selfPct = (b.self / totalSampleTime * 100).toFixed(1);
    const totalMs = (b.total / 1000).toFixed(1);
    console.log(
      `${b.key.slice(0, 70).padEnd(70)} ${selfMs.padStart(10)} ${
        (selfPct + "%").padStart(8)
      } ${totalMs.padStart(10)}`,
    );
  }

  const sortByTotal = [...buckets.values()].sort((a, b) => b.total - a.total);
  console.log(
    "\n--- Top 20 by TOTAL/inclusive time (work done by + below) ---",
  );
  console.log(
    `${"Function".padEnd(70)} ${"Total ms".padStart(10)} ${
      "Total %".padStart(9)
    } ${"Self ms".padStart(10)}`,
  );
  console.log("-".repeat(103));
  for (const b of sortByTotal.slice(0, 20)) {
    if (b.total === 0) break;
    const totalMs = (b.total / 1000).toFixed(1);
    const totalPct = (b.total / totalSampleTime * 100).toFixed(1);
    const selfMs = (b.self / 1000).toFixed(1);
    console.log(
      `${b.key.slice(0, 70).padEnd(70)} ${totalMs.padStart(10)} ${
        (totalPct + "%").padStart(9)
      } ${selfMs.padStart(10)}`,
    );
  }
};

for (const profile of profileEvents) {
  if (profile.id === undefined) continue;
  const threadLabel = threadNames.get(`${profile.pid}/${profile.tid}`) ??
    `pid=${profile.pid} tid=${profile.tid}`;
  analyzeProfile(threadLabel, profile.pid, profile.id);
}
