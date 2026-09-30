/**
 * How long the GPU spends on each render pass, and how much it is asked to
 * draw there, for finding what holds frames back when the CPU has time to
 * spare: add `?gpu-timings` to the page's URL and every second the console
 * shows each pass's averages per frame, also kept on `globalThis.gpuTimings`.
 * Timer queries finish a few frames after they are issued, so each frame
 * collects whichever earlier ones have.
 */

/** The parts of a WebGL 2 context timing takes. */
export type TimerContext = {
  getExtension(name: "EXT_disjoint_timer_query_webgl2"): {
    TIME_ELAPSED_EXT: number;
    GPU_DISJOINT_EXT: number;
  } | null;
  createQuery(): WebGLQuery | null;
  beginQuery(target: number, query: WebGLQuery): void;
  endQuery(target: number): void;
  getQueryParameter(query: WebGLQuery, name: number): unknown;
  getParameter(name: number): unknown;
  readonly QUERY_RESULT: number;
  readonly QUERY_RESULT_AVAILABLE: number;
};

/** What a pass drew: its draw calls and the triangles they held. */
export type Draws = { calls: number; triangles: number };

/** A pass's averages per frame. */
export type PassTiming = { ms: number } & Draws;

export type GpuTimings = {
  /** Starts timing `pass`; passes must not overlap. */
  begin(pass: string): void;
  /** Ends the pass begun, with what it drew. */
  end(draws?: Draws): void;
  /** Collects finished timings; every `period` seconds, reports and resets. */
  frame(now: number): void;
};

export const createGpuTimings = (
  gl: TimerContext,
  report: (averages: Record<string, PassTiming>) => void,
  period = 1,
): GpuTimings | undefined => {
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  if (!ext) return;
  const free: WebGLQuery[] = [];
  const pending: { pass: string; query: WebGLQuery }[] = [];
  const totals = new Map<string, PassTiming>();
  const totalOf = (pass: string) => {
    let total = totals.get(pass);
    if (!total) totals.set(pass, total = { ms: 0, calls: 0, triangles: 0 });
    return total;
  };
  let current: { pass: string; query: WebGLQuery } | undefined;
  let frames = 0;
  let since: number | undefined;

  return {
    begin: (pass) => {
      const query = free.pop() ?? gl.createQuery();
      if (!query) return;
      gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
      current = { pass, query };
    },
    end: (draws) => {
      if (!current) return;
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push(current);
      if (draws) {
        const total = totalOf(current.pass);
        total.calls += draws.calls;
        total.triangles += draws.triangles;
      }
      current = undefined;
    },
    frame: (now) => {
      // A disjoint GPU clock spoils whatever finished since it was last asked
      const disjoint = !!gl.getParameter(ext.GPU_DISJOINT_EXT);
      while (
        pending.length &&
        gl.getQueryParameter(pending[0].query, gl.QUERY_RESULT_AVAILABLE)
      ) {
        const { pass, query } = pending.shift()!;
        const elapsed = Number(gl.getQueryParameter(query, gl.QUERY_RESULT));
        if (!disjoint) totalOf(pass).ms += elapsed / 1e6;
        free.push(query);
      }
      frames++;
      since ??= now;
      if (now - since < period) return;
      report(Object.fromEntries(
        [...totals].map(([pass, total]) => [pass, {
          ms: total.ms / frames,
          calls: total.calls / frames,
          triangles: total.triangles / frames,
        }]),
      ));
      totals.clear();
      frames = 0;
      since = now;
    },
  };
};

/** The renderer's own count of what it drew since last reset. */
type DrawCounter = {
  info: {
    autoReset: boolean;
    reset(): void;
    render: { calls: number; triangles: number };
  };
};

let running: { timings: GpuTimings; renderer: DrawCounter } | undefined;
let timing = false;

/** Starts timing `renderer`'s passes, if its context can time them. */
export const startGpuTimings = (
  gl: TimerContext,
  renderer: DrawCounter,
  report: (averages: Record<string, PassTiming>) => void,
) => {
  const timings = createGpuTimings(gl, report);
  if (!timings) return;
  // Counted per pass rather than per render call
  renderer.info.autoReset = false;
  running = { timings, renderer };
};

export const isTimingGpu = () => !!running;

/** Draws, timed as `pass` while timing runs. */
export const timed = (pass: string, draw: () => void) => {
  // Timer queries cannot overlap, so a pass within a pass counts as the outer
  if (!running || timing) return draw();
  const { timings, renderer } = running;
  timing = true;
  renderer.info.reset();
  timings.begin(pass);
  draw();
  timings.end({ ...renderer.info.render });
  timing = false;
};

export const gpuTimingsFrame = (now: number) => running?.timings.frame(now);
