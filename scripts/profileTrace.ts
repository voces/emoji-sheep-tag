/**
 * Where a Chrome trace's time goes, function by function: the long tasks on a
 * thread, then its sampled CPU profile over each time window given, by self
 * and by total time. scripts/analyzeTrace.ts sums the whole trace frame by
 * frame; this narrows in on the moments that matter, such as a load's long
 * tasks or a frame that dropped.
 *
 *   deno run -A scripts/profileTrace.ts trace.json [thread] [from-to ms]...
 *
 * The thread is matched by name (default CrRendererMain; SharedWorker for the
 * local server). Times count from the trace's first event. With no windows it
 * lists the thread's long tasks, to pick windows from.
 */

type TraceEvent = {
  name: string;
  ph: string;
  ts?: number;
  dur?: number;
  pid: number;
  tid: number;
  id?: string;
  args?: {
    name?: string;
    data?: {
      startTime?: number;
      cpuProfile?: {
        nodes?: {
          id: number;
          parent?: number;
          callFrame: {
            functionName: string;
            url?: string;
            lineNumber?: number;
          };
        }[];
        samples?: number[];
      };
      timeDeltas?: number[];
    };
  };
};

const [file, threadName = "CrRendererMain", ...windowArgs] = Deno.args;
if (!file) {
  console.error(
    "Usage: deno run -A scripts/profileTrace.ts trace.json [thread] [from-to]...",
  );
  Deno.exit(1);
}

const parsed = JSON.parse(await Deno.readTextFile(file));
const events: TraceEvent[] = Array.isArray(parsed)
  ? parsed
  : parsed.traceEvents;
const start = events.reduce(
  (min, e) => e.ts ? Math.min(min, e.ts) : min,
  Infinity,
);
const ms = (ts: number) => (ts - start) / 1000;

const threadNames = new Map<string, string>();
for (const e of events) {
  if (e.ph === "M" && e.name === "thread_name" && e.args?.name) {
    threadNames.set(`${e.pid}:${e.tid}`, e.args.name);
  }
}
const threads = new Set(
  [...threadNames].filter(([, name]) => name.includes(threadName)).map((
    [key],
  ) => key),
);

console.log("Long tasks (over 12ms):");
for (
  const task of events
    .filter((e) =>
      e.ph === "X" && e.name === "RunTask" && (e.dur ?? 0) > 12000 &&
      threads.has(`${e.pid}:${e.tid}`)
    )
    .sort((a, b) => a.ts! - b.ts!)
) {
  console.log(
    `  at ${ms(task.ts!).toFixed(0).padStart(7)}ms  ${
      (task.dur! / 1000).toFixed(1).padStart(7)
    }ms`,
  );
}

// Each profile is a thread's own, numbered apart from the others'; chunks name
// the profile they extend rather than the thread sampled
type Frame = { functionName: string; url?: string; lineNumber?: number };
type Profile = {
  start: number;
  nodes: Map<number, Frame>;
  parents: Map<number, number>;
  samples: [node: number, delta: number][];
};
const profiles = new Map<string, Profile>();
for (const e of events) {
  if (e.name !== "Profile" || !threads.has(`${e.pid}:${e.tid}`)) continue;
  profiles.set(e.id!, {
    start: e.args?.data?.startTime ?? 0,
    nodes: new Map(),
    parents: new Map(),
    samples: [],
  });
}
for (const e of events) {
  const profile = e.name === "ProfileChunk" && profiles.get(e.id!);
  if (!profile) continue;
  const { cpuProfile, timeDeltas = [] } = e.args?.data ?? {};
  for (const node of cpuProfile?.nodes ?? []) {
    profile.nodes.set(node.id, node.callFrame);
    if (node.parent !== undefined) profile.parents.set(node.id, node.parent);
  }
  (cpuProfile?.samples ?? []).forEach((node, i) =>
    profile.samples.push([node, timeDeltas[i] ?? 0])
  );
}

const label = (frame: Frame | undefined) =>
  frame
    ? `${frame.functionName || "(anonymous)"} ${
      (frame.url ?? "").split("/").at(-1)
    }:${(frame.lineNumber ?? 0) + 1}`
    : "?";
const IDLE = new Set(["(idle)", "(program)", "(root)"]);

for (const window of windowArgs) {
  const [from, to] = window.split("-").map(Number);
  const self = new Map<string, number>();
  const total = new Map<string, number>();
  let sampled = 0;
  for (const profile of profiles.values()) {
    let t = profile.start;
    const timed = profile.samples.map(([node, delta]) => {
      t += delta;
      return [ms(t), node] as const;
    });
    for (let i = 0; i + 1 < timed.length; i++) {
      const [at, node] = timed[i];
      if (at < from || at >= to) continue;
      const frame = profile.nodes.get(node);
      if (!frame || IDLE.has(frame.functionName)) continue;
      // A gap in sampling is not time spent where the last sample landed
      const dt = Math.min(timed[i + 1][0] - at, 5);
      sampled += dt;
      self.set(label(frame), (self.get(label(frame)) ?? 0) + dt);
      const seen = new Set<string>();
      for (let n: number | undefined = node; n !== undefined;) {
        const name = label(profile.nodes.get(n));
        if (!seen.has(name) && !IDLE.has(profile.nodes.get(n)!.functionName)) {
          seen.add(name);
          total.set(name, (total.get(name) ?? 0) + dt);
        }
        n = profile.parents.get(n);
      }
    }
  }
  const top = (counts: Map<string, number>, count: number) =>
    [...counts].sort((a, b) => b[1] - a[1]).slice(0, count)
      .map(([name, time]) => `  ${time.toFixed(1).padStart(8)}ms  ${name}`)
      .join("\n");
  console.log(`\n${window}ms: ${sampled.toFixed(0)}ms sampled`);
  console.log(` by self time:\n${top(self, 20)}`);
  console.log(
    ` by total time:\n${top(total, Number(Deno.env.get("TOP") ?? 30))}`,
  );
}
