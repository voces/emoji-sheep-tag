/**
 * Public estune API. Vendor consumers import from this file.
 *
 * Typical use:
 *
 *   import { startEngine, setGameState, fireGameEvent } from "./estune/index.ts";
 *
 *   // First user gesture (autoplay policy):
 *   const engine = await startEngine({
 *     audioContext: hostCtx,        // optional — engine creates one if omitted
 *     outputBus: hostMusicBusNode,  // optional — defaults to ctx.destination
 *   });
 *
 *   // Every game tick:
 *   setGameState(engine, fullGameState);
 *
 *   // Discrete events:
 *   fireGameEvent(engine, { type: "capture", subject: "self" });
 *
 * That's it. The bed library and stingers are loaded inside startEngine
 * from the inlined segment sources — consumers don't touch the segment
 * authoring at all.
 *
 * Lower-level escape hatches (for custom hooks, custom stingers, or
 * deferred startup) are available below.
 */

export * from "./api.ts";
export { buildBedLibraryFromText, type BedSource, type BedLibrary } from "./bedLibrary.ts";
export { compileSegment } from "./compiler.ts";
export { BED_SOURCES, HOOK_SOURCES, STINGER_SOURCES } from "./segmentSources.generated.ts";
export {
  buildDefaultBedLibrary as buildDefaultBedLibraryFromSources,
  registerDefaultStingers as registerDefaultStingersFromSources,
  type DefaultLibraryOptions,
} from "./defaults.ts";
// Explicit re-export of the recorder API. `export * from "./api.ts"`
// propagates these too, but listing them here keeps the surface
// discoverable in IDE autocomplete on the vendor's index.
export {
  startRecording, stopRecording, isRecording,
  type Recording, type RecordedNote, type RecordedStateSample,
  type RecordedEvent, type RecordedBedChange, type RecordedInput,
} from "./recorder.ts";
export {
  replayRecording, diffRecordings,
  type ReplayOptions, type RecordingDiff, type DiffOptions,
} from "./replay.ts";

import {
  buildDefaultBedLibrary as _buildDefault,
  registerDefaultStingers as _registerDefault,
  type DefaultLibraryOptions,
} from "./defaults.ts";
import {
  createV3Engine, installBedLibrary, startV3Engine, type V3EngineState,
} from "./engine.ts";
import { setSF2OutputBus } from "./sf2.ts";
import {
  BED_SOURCES, HOOK_SOURCES, STINGER_SOURCES,
} from "./segmentSources.generated.ts";

export interface StartEngineOptions extends DefaultLibraryOptions {
  /** Existing AudioContext to share (so SF2 output flows through the same
   *  bus chain as the rest of the host's audio). If omitted, the engine
   *  creates its own context. */
  audioContext?: AudioContext;
  /** Bus node to route the SF2 output through (e.g. the host's master /
   *  music gain node). If omitted, output connects to ctx.destination. */
  outputBus?: AudioNode;
}

/** One-shot engine bootstrap. Creates the engine, loads the SF2, builds
 *  the canonical bed library, registers the canonical stingers, and
 *  returns ready-to-use state. After this, the consumer only needs
 *  setGameState / fireGameEvent. Idempotent if called more than once on
 *  the same options — though typically called once per session. */
export async function startEngine(opts: StartEngineOptions = {}): Promise<V3EngineState> {
  const engine = createV3Engine([]);
  if (opts.audioContext) engine.ctx = opts.audioContext;
  if (opts.outputBus) setSF2OutputBus(opts.outputBus);
  await startV3Engine(engine);
  installBedLibrary(engine, _buildDefault(BED_SOURCES, HOOK_SOURCES, opts));
  _registerDefault(engine, STINGER_SOURCES);
  return engine;
}

/** Build the canonical bed library without engine wiring. Useful if you
 *  want to construct it at boot but defer engine startup until first
 *  user gesture, or want to reuse the library across multiple engines. */
export function buildDefaultBedLibrary(opts: DefaultLibraryOptions = {}) {
  return _buildDefault(BED_SOURCES, HOOK_SOURCES, opts);
}

/** Register the canonical stingers on an existing engine. Use if you
 *  built your own engine via createV3Engine + startV3Engine and want
 *  the default stinger set without doing the per-stinger work yourself. */
export function registerDefaultStingers(engine: V3EngineState): void {
  _registerDefault(engine, STINGER_SOURCES);
}
