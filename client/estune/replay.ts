/**
 * Replay: drive the engine from a captured Recording.
 *
 * Use case: iterate on the engine without replaying gameplay every time.
 * Drop a recording.json into replayRecording, point it at a fresh engine
 * (which uses the *current* bed library and segment authoring), and either
 * listen to it (`realtime: true`) or capture a fresh recording for
 * comparison (`realtime: false`).
 *
 * What gets replayed:
 *   - inputs[]: every setGameState call the game made, pumped at the
 *     same ms offsets as the original session
 *   - events[]: every fireGameEvent call, interleaved chronologically
 *     with the input stream
 *   - sessionSeed: restored before replay so per-session layer transforms
 *     and per-loop activity gating reproduce exactly
 *
 * Determinism: replays match the original output note-for-note when:
 *   1. The bed library is identical (same .seg sources)
 *   2. The hook library is identical
 *   3. The stinger library is identical
 *   4. Replay is realtime (smoothing dt matches recorded cadence)
 *
 * If you re-author segments and replay, the replay uses the NEW authoring —
 * which is the whole point. Outputs will differ; the input stream is what
 * stays constant.
 */

import { type V3EngineState } from "./engine.ts";
import { setGameState, fireGameEvent } from "./api.ts";
import { setSessionSeed, rendererTick } from "./renderer.ts";
import { stingerTick } from "./stingers.ts";
import {
  type Recording, type RecordedInput, type RecordedEvent,
  startRecording, stopRecording,
} from "./recorder.ts";

export interface ReplayOptions {
  /** When true, pump inputs at original wall-clock pacing (audible
   *  playback). When false, fire as fast as possible — audio still
   *  fires through whatever sf2 backend the engine uses, so
   *  offline-without-audio requires a host that mocks sf2.noteOn.
   *  Default: true. */
  realtime?: boolean;
  /** When true (default), record the replay's outputs. The returned
   *  Recording has the new outputs alongside the replayed inputs. */
  capture?: boolean;
  /** Called every ~100ms during replay with progress 0-1. */
  onProgress?: (progress: number) => void;
}

type TimelineEntry =
  | { ms: number; kind: "input"; payload: RecordedInput["state"] }
  | { ms: number; kind: "event"; payload: RecordedEvent["event"] };

/** Test-only re-export. Production code shouldn't import this. */
export const mergeTimelineForTest = (rec: Recording): TimelineEntry[] => mergeTimeline(rec);

/** Reconstruct an input stream from a recording's `states` array.
 *  Used as a fallback when replaying older recordings that predate the
 *  `inputs` capture (added when replay shipped). The reconstructed inputs
 *  are post-smoothing samples; replay will smooth them again, producing
 *  approximate but not bit-identical behavior. Adequate for "what does
 *  this round sound like with my new authoring" use cases. */
function reconstructInputsFromStates(rec: Recording): RecordedInput[] {
  return rec.states.map(s => ({
    ms: s.ms,
    state: {
      state: s.state,
      perspective: s.perspective,
      mode: s.mode,
      sheep: s.sheep ? { ...s.sheep } : undefined,
      wolf: s.wolf ? { ...s.wolf } : undefined,
      roundHook: null,
    },
  }));
}

/** Merge the input + event streams into one chronological timeline.
 *  Falls back to reconstructing inputs from `states` if `inputs` is
 *  missing/empty (backward compatibility with pre-replay recordings). */
function mergeTimeline(rec: Recording): TimelineEntry[] {
  const inputs = (rec.inputs && rec.inputs.length > 0)
    ? rec.inputs
    : reconstructInputsFromStates(rec);

  const out: TimelineEntry[] = [];
  for (const i of inputs) out.push({ ms: i.ms, kind: "input", payload: i.state });
  for (const e of rec.events) out.push({ ms: e.ms, kind: "event", payload: e.event });
  // Stable sort: inputs before events at the same ms (events reference state
  // that should already be applied). Sort first by ms, then by kind weight.
  out.sort((a, b) => {
    if (a.ms !== b.ms) return a.ms - b.ms;
    return a.kind === "input" ? -1 : b.kind === "input" ? 1 : 0;
  });
  return out;
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/** Resolution for the headless beat clock. Smaller = more accurate
 *  scheduling at the cost of more tick calls. 50ms ≈ 1/12 beat at
 *  100 BPM, well below the renderer's 4-beat lookahead, so notes
 *  inside the lookahead window are caught reliably. */
const HEADLESS_TICK_MS = 50;

/** Advance the engine's beat clock by one offline tick. Drives both
 *  the renderer (for note scheduling) and the stinger track. The
 *  engine's audio context is normally what advances beats; this is
 *  the headless equivalent for offline replay. */
function tickEngine(engine: V3EngineState, beat: number): void {
  engine.beat = beat;
  rendererTick(engine.renderer, beat);
  stingerTick(engine.stingerTrack, beat, engine.renderer.lookaheadBeats);
}

/**
 * Replay a recorded session through the given engine. Returns a fresh
 * Recording capturing the replay's outputs (when capture=true; default).
 */
export async function replayRecording(
  engine: V3EngineState,
  source: Recording,
  options: ReplayOptions = {},
): Promise<Recording | null> {
  const realtime = options.realtime ?? true;
  const capture = options.capture ?? true;

  // Restore the session seed so layer transforms / activity gating match.
  // Without this, color voices may pick different octave-shifts and drop
  // patterns, producing a different audible surface even with identical
  // inputs. Pre-replay recordings don't have this field — leave the
  // engine's current seed in place.
  if (source.sessionSeed) setSessionSeed(engine.renderer, source.sessionSeed);

  if (capture) startRecording(engine);

  const timeline = mergeTimeline(source);
  if (timeline.length === 0) {
    return capture ? stopRecording(engine) : null;
  }

  const startWallClock = nowMs();
  let lastProgressReport = -1;
  const totalMs = source.durationMs || timeline[timeline.length - 1].ms;

  // Headless beat-clock state (offline mode only). Advances based on the
  // currently playing segment's tempo, in HEADLESS_TICK_MS increments,
  // between each input event.
  let offlineBeat = 0;
  let offlineLastMs = 0;

  function advanceOfflineTo(targetMs: number): void {
    while (offlineLastMs < targetMs) {
      const stepMs = Math.min(targetMs - offlineLastMs, HEADLESS_TICK_MS);
      const tempo = engine.renderer.primary?.segment.tempo ?? 100;
      offlineBeat += (stepMs / 1000) * (tempo / 60);
      offlineLastMs += stepMs;
      tickEngine(engine, offlineBeat);
    }
  }

  for (const entry of timeline) {
    if (realtime) {
      const targetWallClock = startWallClock + entry.ms;
      let waitMs = targetWallClock - nowMs();
      while (waitMs > 0) {
        // Sleep in small increments so progress callbacks fire often
        // and the host can interrupt by stopping the recorder.
        await sleep(Math.min(waitMs, 16));
        waitMs = targetWallClock - nowMs();
      }
    } else {
      // Offline: drive the headless clock up to this entry's ms before
      // pumping the input. This ensures the renderer schedules notes
      // for the time window the input was originally fired in.
      advanceOfflineTo(entry.ms);
    }

    if (entry.kind === "input") {
      setGameState(engine, entry.payload);
    } else {
      fireGameEvent(engine, entry.payload);
    }

    if (options.onProgress && totalMs > 0) {
      const p = Math.min(1, entry.ms / totalMs);
      // Report at ~10% increments to avoid callback spam
      const bucket = Math.floor(p * 10);
      if (bucket !== lastProgressReport) {
        lastProgressReport = bucket;
        options.onProgress(p);
      }
    }
  }

  // Final drain: tick a few more beats past the last input so any pending
  // note-offs and the renderer's lookahead-scheduled notes resolve.
  if (!realtime) {
    advanceOfflineTo(offlineLastMs + 4000); // 4 seconds @ ~100 BPM ≈ 6.7 beats
  }

  return capture ? stopRecording(engine) : null;
}

/**
 * Compare two recordings' note streams for regression testing. Returns a
 * summary of differences keyed by (voice, beat, midi) tuples. Tolerates
 * small ms drift from realtime scheduling jitter.
 */
export interface RecordingDiff {
  totalNotesA: number;
  totalNotesB: number;
  /** Notes in A that have no near-match in B (within toleranceMs). */
  missingInB: Array<{ ms: number; voice: string; midi: number; velocity: number }>;
  /** Notes in B that have no near-match in A. */
  extraInB: Array<{ ms: number; voice: string; midi: number; velocity: number }>;
  /** Notes that match (voice, midi) but differ in velocity beyond
   *  velocityTolerance. */
  velocityMismatches: Array<{
    ms: number; voice: string; midi: number; velA: number; velB: number;
  }>;
}

export interface DiffOptions {
  toleranceMs?: number;       // default 50
  velocityTolerance?: number; // default 0.05
}

export function diffRecordings(
  a: Recording,
  b: Recording,
  options: DiffOptions = {},
): RecordingDiff {
  const toleranceMs = options.toleranceMs ?? 50;
  const velocityTolerance = options.velocityTolerance ?? 0.05;

  const matched = new Set<number>();
  const result: RecordingDiff = {
    totalNotesA: a.notes.length,
    totalNotesB: b.notes.length,
    missingInB: [],
    extraInB: [],
    velocityMismatches: [],
  };

  for (const na of a.notes) {
    let bestIdx = -1;
    let bestDelta = Infinity;
    for (let i = 0; i < b.notes.length; i++) {
      if (matched.has(i)) continue;
      const nb = b.notes[i];
      if (nb.voice !== na.voice || nb.midi !== na.midi) continue;
      const delta = Math.abs(nb.ms - na.ms);
      if (delta > toleranceMs) continue;
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) {
      result.missingInB.push({ ms: na.ms, voice: na.voice, midi: na.midi, velocity: na.velocity });
    } else {
      matched.add(bestIdx);
      const nb = b.notes[bestIdx];
      if (Math.abs(nb.velocity - na.velocity) > velocityTolerance) {
        result.velocityMismatches.push({
          ms: na.ms, voice: na.voice, midi: na.midi,
          velA: na.velocity, velB: nb.velocity,
        });
      }
    }
  }
  for (let i = 0; i < b.notes.length; i++) {
    if (matched.has(i)) continue;
    const nb = b.notes[i];
    result.extraInB.push({ ms: nb.ms, voice: nb.voice, midi: nb.midi, velocity: nb.velocity });
  }

  return result;
}
