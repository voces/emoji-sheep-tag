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
