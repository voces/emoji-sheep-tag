/**
 * Replays recorded rounds headlessly, verifying them against their recorded
 * checkpoints and timing the simulation.
 *
 *   deno task replay [--repeat N] [--systems] [--wasm] <file.jsonl[.gz]>...
 *
 * `--wasm` runs path searches in the VL-compiled engine (shared/pathing/vl/).
 *
 * Exits non-zero when any replay diverges from its recording.
 */
import process from "node:process";
import { parseArgs } from "node:util";
import { loadReplay } from "../server/replay/load.ts";
import { type ReplayResult, replayRound } from "../server/replay/replay.ts";
import { TICK_RATE } from "@/shared/constants.ts";
import { systemsLoaded } from "../server/ecs.ts";
import { setWasmPathing } from "@/shared/pathing/vl/VlSearch.ts";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    repeat: { type: "string", default: "1" },
    systems: { type: "boolean", default: false },
    wasm: { type: "boolean", default: false },
  },
});

const repeat = Math.max(1, Number(values.repeat) || 1);
if (!positionals.length) {
  console.error(
    "usage: deno task replay [--repeat N] [--systems] [--wasm] <file.jsonl[.gz]>...",
  );
  process.exit(2);
}

const ms = (value: number) =>
  value >= 100 ? `${value.toFixed(0)}ms` : `${value.toFixed(2)}ms`;

const percentile = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

// The game logs chat and round events; keep the report readable
const quietly = <T>(fn: () => T): T => {
  const { log, info } = console;
  console.log = console.info = () => {};
  try {
    return fn();
  } finally {
    console.log = log;
    console.info = info;
  }
};

const describeRun = (result: ReplayResult) => {
  const ticks = [...result.timing.tickMs].sort((a, b) => a - b);
  const total = sum(result.timing.tickMs) + result.timing.inputMs;
  const realtime = result.ticks * TICK_RATE * 1000 / total;
  return {
    total,
    line: `${ms(total)} (${realtime.toFixed(1)}x realtime) · tick p50 ${
      ms(percentile(ticks, 0.5))
    } p95 ${ms(percentile(ticks, 0.95))} p99 ${
      ms(percentile(ticks, 0.99))
    } max ${ms(ticks.at(-1) ?? 0)} · inputs ${ms(result.timing.inputMs)}`,
  };
};

await systemsLoaded;
if (values.wasm) setWasmPathing(true);

let diverged = false;

for (const path of positionals) {
  const replay = await loadReplay(path);
  const { header } = replay;

  console.log(
    `${path}\n  ${header.map.id} · ${header.settings.mode} · ${header.sheep.length}v${header.wolves.length}${
      header.practice ? " · practice" : ""
    } · recorded ${header.recordedAt} on ${header.gameVersion} (${header.host})`,
  );

  const runs = Array.from(
    { length: repeat },
    () =>
      quietly(() => replayRound(replay, { profileSystems: values.systems })),
  );
  const first = runs[0];

  const verdict = first.firstDivergence
    ? `DIVERGED at tick ${first.firstDivergence.tick} (expected ${first.firstDivergence.expected}, got ${first.firstDivergence.actual})`
    : `${first.checkpoints} checkpoints match`;
  const ending = first.recordedEndTick === undefined
    ? "recording has no end"
    : first.ticks === first.recordedEndTick &&
        first.winner === first.recordedWinner
    ? `ended at tick ${first.ticks} as recorded${
      first.winner ? ` (${first.winner} won)` : ""
    }`
    : `ended at tick ${first.ticks}${
      first.winner ? ` (${first.winner} won)` : ""
    }, recorded ${first.recordedEndTick}${
      first.recordedWinner ? ` (${first.recordedWinner} won)` : ""
    }`;
  console.log(`  ${verdict} · ${ending}`);
  if (first.firstDivergence) diverged = true;

  const skipped = Object.entries(first.skipped);
  if (skipped.length) {
    console.log(
      `  skipped inputs: ${skipped.map(([t, n]) => `${t} ×${n}`).join(", ")}`,
    );
  }

  const described = runs.map(describeRun);
  described.forEach(({ line }, i) =>
    console.log(`  run ${i + 1}/${repeat}: ${line}`)
  );

  if (values.systems) {
    const best = runs[
      described.indexOf(
        described.reduce((a, b) => (b.total < a.total ? b : a)),
      )
    ];
    const systems = [...best.timing.systemMs].sort((a, b) => b[1] - a[1]);
    const systemsTotal = sum(systems.map(([, t]) => t));
    const tickTotal = sum(best.timing.tickMs);
    console.log("  systems, fastest run:");
    for (const [label, time] of systems.slice(0, 15)) {
      console.log(
        `    ${ms(time).padStart(9)} ${
          (100 * time / tickTotal).toFixed(1).padStart(5)
        }%  ${label}`,
      );
    }
    console.log(
      `    ${ms(tickTotal - systemsTotal).padStart(9)} ${
        (100 * (tickTotal - systemsTotal) / tickTotal).toFixed(1).padStart(5)
      }%  (callbacks, flush, update serialization)`,
    );
  }
}

process.exit(diverged ? 1 : 0);
