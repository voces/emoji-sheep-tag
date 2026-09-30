import { expect } from "@std/expect";
import { it } from "@std/testing/bdd";
import {
  createGpuTimings,
  type PassTiming,
  type TimerContext,
} from "./gpuTimings.ts";

/**
 * A context whose queries take `elapsed` nanoseconds and finish only once
 * `finish` is called, as a GPU's finish frames after they are issued.
 */
const timerContext = () => {
  const state = new Map<WebGLQuery, { done: boolean; elapsed: number }>();
  let next = 0;
  const gl = {
    QUERY_RESULT: 1,
    QUERY_RESULT_AVAILABLE: 2,
    getExtension: () => ({ TIME_ELAPSED_EXT: 3, GPU_DISJOINT_EXT: 4 }),
    createQuery: () => ({}) as WebGLQuery,
    beginQuery: (_: number, query: WebGLQuery) =>
      state.set(query, { done: false, elapsed: next }),
    endQuery: () => {},
    getQueryParameter: (query: WebGLQuery, name: number) =>
      name === 2 ? state.get(query)?.done : state.get(query)?.elapsed,
    getParameter: () => false,
  } satisfies TimerContext;
  return {
    gl,
    takes: (ns: number) => next = ns,
    finish: () => state.forEach((q) => q.done = true),
  };
};

it("reports each pass's average GPU time and draws per frame once its queries finish", () => {
  const { gl, takes, finish } = timerContext();
  const reports: Record<string, PassTiming>[] = [];
  const timings = createGpuTimings(gl, (r) => reports.push(r), 1)!;

  for (const [frame, now] of [0, 0.5].entries()) {
    takes(2e6 * (frame + 1));
    timings.begin("world");
    timings.end({ calls: 30, triangles: 900 });
    takes(1e6);
    timings.begin("fog");
    timings.end({ calls: 2, triangles: 4 });
    timings.frame(now);
  }
  // Nothing finished yet, so a period passing reports nothing timed
  expect(reports).toEqual([]);

  finish();
  timings.frame(1);
  // Three frames counted, the two timed ones' queries summed across them
  expect(reports).toEqual([{
    world: { ms: 6 / 3, calls: 60 / 3, triangles: 1800 / 3 },
    fog: { ms: 2 / 3, calls: 4 / 3, triangles: 8 / 3 },
  }]);
});
