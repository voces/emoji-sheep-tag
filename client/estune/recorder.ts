/**
 * Recording: capture engine output for offline inspection.
 *
 * Use case: debugging audible artifacts you can't blind-guess about — e.g.
 * "the wolf bed goes crazy at proximity boundaries". Start recording, play
 * a scenario, stop, and serialize the result. The output is JSON the engine
 * authors / Claude can read back to see exactly which notes fired with what
 * velocity, on what voice, when each bed was selected, what facets the bed
 * selection saw, and which events were dispatched.
 *
 * Captured streams (all share the engine's beat clock so they can be aligned):
 *   - states: per-tick game-state sample with current bed selection + mix
 *   - notes: every scheduled note (layer id, midi, velocity, duration)
 *   - events: GameEvents fired (capture / rescue / round-end / etc.)
 *   - bedChanges: bed transitions with crossfade params
 *
 * The recording is enabled by attaching a `Recording` to `engine.recorder`
 * (via `startRecording`); engine code checks for it at the relevant hook
 * points and appends. Stop with `stopRecording` to detach and return the
 * captured data.
 */

import { type V3EngineState } from "./engine.ts";
import {
  type FullGameState, type StructuralState, type Perspective, type GameMode,
  type SheepFacets, type WolfFacets, type GameEvent, type MoodParams,
} from "./types.ts";
import { type BedSelection } from "./beds.ts";

export interface RecordedStateSample {
  /** ms since startRecording. */
  ms: number;
  /** Engine beat at sample time. */
  beat: number;
  state: StructuralState;
  perspective: Perspective;
  mode?: GameMode;
  sheep?: SheepFacets;
  wolf?: WolfFacets;
  /** Bed selection the director computed (active beds only — null in lobby/build). */
  selection: BedSelection | null;
  /** Per-layer-id gain factors the modulation layer applied this tick. */
  layerGains: Record<string, number>;
  /** Bed currently playing (BedDirectorState.currentBed at sample time). */
  currentBed: string | null;
  /** Smoothed mood the renderer sees this tick. `tension` is the bleed
   *  driver; useful for confirming threat-driven envelopes are actually
   *  responding to gameplay (e.g. wolf proximity for sheep). */
  mood: MoodParams;
}

export interface RecordedNote {
  ms: number;
  beat: number;
  /** Layer id (e.g. "melody", "bass", or the segment's role-named layer). */
  voice: string;
  midi: number;
  /** Velocity 0-1 (post-modulation). */
  velocity: number;
  /** Duration in beats. */
  duration: number;
}

export interface RecordedEvent {
  ms: number;
  beat: number;
  event: GameEvent;
}

export interface RecordedBedChange {
  ms: number;
  beat: number;
  /** null if there was no prior bed (first one at session start). */
  from: string | null;
  to: string;
  /** Segment key + tempo of the new bed (helps explain audible jumps). */
  toKey: string;
  toTempo: number;
}

/** Raw game→engine input. Captured *before* facet smoothing, so replays
 *  produce the same smoothed values (smoothing depends on dt; given the
 *  same input sequence at the same wall-clock cadence, the result is
 *  reproducible). The `states` array is the post-smoothing analytic
 *  view; this is the source-of-truth for replay. */
export interface RecordedInput {
  ms: number;
  state: FullGameState;
}

export interface Recording {
  /** performance.now() at startRecording. */
  startedAtMs: number;
  /** Wall-clock duration in ms. Set on stopRecording. */
  durationMs: number;
  /** Renderer session seed at recording time. Replay must restore this
   *  before pumping inputs so layer transforms and per-loop activity
   *  gating produce the same surface choices. Empty string if the seed
   *  was never set. */
  sessionSeed: string;
  /** Raw inputs the game sent to the engine. Source-of-truth for replay. */
  inputs: RecordedInput[];
  /** Per-tick smoothed state samples — analytic view, not used by replay. */
  states: RecordedStateSample[];
  notes: RecordedNote[];
  events: RecordedEvent[];
  bedChanges: RecordedBedChange[];
}

/** Start capturing engine output. Returns the Recording so callers can
 *  observe it live; stopRecording returns the same object with durationMs
 *  filled in. Calling startRecording while a recording is already active
 *  discards the previous recording. */
export function startRecording(engine: V3EngineState): Recording {
  const rec: Recording = {
    startedAtMs: now(),
    durationMs: 0,
    sessionSeed: engine.renderer.sessionSeed,
    inputs: [],
    states: [],
    notes: [],
    events: [],
    bedChanges: [],
  };
  engine.recorder = rec;
  return rec;
}

/** Detach and finalize the recording. Returns null if none was active. */
export function stopRecording(engine: V3EngineState): Recording | null {
  const rec = engine.recorder;
  if (!rec) return null;
  rec.durationMs = now() - rec.startedAtMs;
  engine.recorder = null;
  return rec;
}

/** True if a recording is currently attached to the engine. */
export function isRecording(engine: V3EngineState): boolean {
  return engine.recorder !== null;
}

// ── Internal hook helpers (called by engine code at instrumented points) ──

/** Capture the raw input the game sent (pre-smoothing). Called from
 *  setFullGameState before any facet smoothing is applied. */
export function recordInput(
  rec: Recording,
  _engine: V3EngineState,
  state: FullGameState,
): void {
  // Deep-clone facet objects since the engine mutates them in place
  // during smoothing. The top-level state is recreated each tick by
  // the host, so a shallow clone of it + nested clones of facets is
  // sufficient.
  rec.inputs.push({
    ms: now() - rec.startedAtMs,
    state: {
      ...state,
      sheep: state.sheep ? { ...state.sheep } : undefined,
      wolf: state.wolf ? { ...state.wolf } : undefined,
      anticipation: state.anticipation ? state.anticipation.map(a => ({ ...a })) : undefined,
    },
  });
}

export function recordState(
  rec: Recording,
  engine: V3EngineState,
  state: FullGameState,
): void {
  rec.states.push({
    ms: now() - rec.startedAtMs,
    beat: engine.beat,
    state: state.state,
    perspective: state.perspective,
    mode: state.mode,
    sheep: state.sheep ? { ...state.sheep } : undefined,
    wolf: state.wolf ? { ...state.wolf } : undefined,
    selection: engine.bedDirector.lastSelection
      ? { ...engine.bedDirector.lastSelection }
      : null,
    layerGains: engine.bedDirector.lastMix
      ? Object.fromEntries(engine.bedDirector.lastMix.layerGains)
      : {},
    currentBed: engine.bedDirector.currentBed,
    mood: { ...engine.renderer.mood },
  });
}

export function recordNote(
  rec: Recording,
  engine: V3EngineState,
  voice: string,
  midi: number,
  velocity: number,
  beat: number,
  duration: number,
): void {
  rec.notes.push({
    ms: now() - rec.startedAtMs,
    beat,
    voice,
    midi,
    velocity,
    duration,
  });
}

export function recordEvent(
  rec: Recording,
  engine: V3EngineState,
  event: GameEvent,
): void {
  rec.events.push({
    ms: now() - rec.startedAtMs,
    beat: engine.beat,
    event,
  });
}

export function recordBedChange(
  rec: Recording,
  engine: V3EngineState,
  from: string | null,
  to: string,
  toKey: string,
  toTempo: number,
): void {
  rec.bedChanges.push({
    ms: now() - rec.startedAtMs,
    beat: engine.beat,
    from,
    to,
    toKey,
    toTempo,
  });
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
