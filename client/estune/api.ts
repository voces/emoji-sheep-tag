/**
 * Public engine API for game integration.
 *
 * Game code drives the engine through three entry points:
 *   - setGameState(state)      — every tick, pass the full game state vector
 *                                including the perspective's facets
 *   - fireGameEvent(event)     — discrete narrative events that trigger stingers
 *   - setRoundHook(hook, lib)  — at round start, choose this round's leitmotif
 *
 * The game produces SheepFacets / WolfFacets directly (it knows weapon ranges,
 * terrain, line-of-sight rules better than any in-engine heuristic could).
 * The engine smooths those facets temporally, selects beds by them, and
 * modulates the running mix. All other engine internals (renderer, director,
 * beds, modulation) are implementation details.
 *
 * Structural transitions (lobby → build → active → lobby) are NOT events —
 * the engine detects them from the per-tick `state` field and fires bed-
 * bridge stingers automatically. The event channel is for narrative beats
 * the state field doesn't already convey (capture, rescue, etc).
 */

import {
  type V3EngineState, setFullGameState, fireStingerById, installBedLibrary,
} from "./engine.ts";
import { recordEvent } from "./recorder.ts";
import {
  type FullGameState, type GameEvent, type Hook,
  type SheepFacets, type WolfFacets, type StructuralState,
  type Perspective,
} from "./types.ts";
import { type BedLibrary } from "./bedLibrary.ts";

// ── Public types ──

export type { FullGameState, GameEvent, Hook, BedLibrary, SheepFacets, WolfFacets,
  StructuralState, Perspective };
export {
  startRecording, stopRecording, isRecording,
  type Recording, type RecordedNote, type RecordedStateSample,
  type RecordedEvent, type RecordedBedChange,
} from "./recorder.ts";

// ── Mapping from GameEvent type to stinger id ──

const EVENT_STINGER: Partial<Record<GameEvent["type"], string>> = {
  "capture": "capture",
  "rescue": "rescue",
  // assassination-attempt: no dedicated stinger composed yet — leaving
  // unmapped is a no-op. Add a "near-miss.seg" stinger and wire it here
  // when authored. Until then the bed's threat-driven response carries
  // the moment.
  // round-end is handled below — it picks per-winner.
};

// ── Public API ──

/**
 * Drive the engine with the current game state. Call every game tick
 * (~10-20 Hz). The engine smooths facets internally; this is just a
 * snapshot of the current target state.
 */
export function setGameState(engine: V3EngineState, state: FullGameState): void {
  setFullGameState(engine, state);
}

/**
 * Fire a discrete game event. Maps to a stinger overlay where applicable.
 * Events without a stinger mapping are no-ops (still safe to call).
 */
export function fireGameEvent(engine: V3EngineState, event: GameEvent): void {
  if (engine.recorder) recordEvent(engine.recorder, engine, event);

  let stingerId = EVENT_STINGER[event.type];

  // round-end picks per (winner × perspective). Spirit perspective tracks
  // sheep audio — same stingers as the live sheep player.
  if (event.type === "round-end") {
    const isSheepView = engine.director.perspective !== "wolf";
    if (event.winner === "sheep") {
      stingerId = isSheepView ? "rescue" : "wolf-loss-fade";
    } else {
      stingerId = isSheepView ? "sheep-loss-fade" : "wolf-win";
    }
  }

  if (stingerId) fireStingerById(engine, stingerId);
}

/**
 * Install the round's leitmotif hook by re-building the bed library.
 * Should be called once per round (typically at round start).
 *
 * Currently a no-op shim — call buildBedLibraryFromText in your
 * harness instead. This entry point exists for API symmetry; the
 * harness owns segment sources, so it's responsible for re-building
 * the library.
 */
export function setRoundHook(engine: V3EngineState, _hook: Hook, library: BedLibrary): void {
  installBedLibrary(engine, library);
}
