/**
 * V3 Engine: connects the renderer, director, clock, and SF2 player.
 *
 * The director decides WHAT to play (segment selection based on game state).
 * The renderer handles HOW to play it (scheduling notes through SF2).
 * The engine wires them together with the clock.
 */

import { loadSF2, allNotesOff } from "./sf2.ts";
import { createClock, startClock, stopClock, type ClockState } from "./clock.ts";
import { type Segment, type GamePhase, type Perspective,
  type SheepFacets, type WolfFacets } from "./types.ts";
import { smoothSheepFacets, smoothWolfFacets } from "./facets.ts";
import {
  type RendererState, createRenderer, playSegment, rendererTick, stopAll,
} from "./renderer.ts";
import {
  type DirectorState, createDirector, startDirector,
  onSegmentEnd, onPhaseChange, getPhaseFamily, switchFamilyForPrefade,
} from "./director.ts";
import {
  type BedDirectorState, createBedDirector, setBedLibrary, applyGameState,
  buildBedBridgeSegment, buildRescuePreswellSegment, advanceRound,
} from "./bedDirector.ts";
import { type BedLibrary } from "./bedLibrary.ts";
import { type FullGameState } from "./types.ts";
import {
  type StingerTrack, type Stinger,
  createStingerTrack, fireStinger, stingerTick, stopAllStingers,
} from "./stingers.ts";
import {
  type Recording, recordState, recordNote, recordBedChange, recordInput,
} from "./recorder.ts";

/** Sub-beats per beat. 4 = sixteenth note resolution. */
const SUBDIVISION = 4;

/** Pre-fade: we know a phase change is coming, start crossfade early. */
interface PendingTransition {
  phase: GamePhase;
  /** Wall-clock time (seconds) when the transition should be fully in. */
  targetTime: number;
  /** Has the pre-fade crossfade already started? */
  started: boolean;
}

export interface V3EngineState {
  ctx: AudioContext | null;
  clock: ClockState | null;
  renderer: RendererState;
  director: DirectorState;
  /** Phase-2 bed director (Phase 2 architecture, parallel to phase-based director). */
  bedDirector: BedDirectorState;
  /** Stinger track (overlay cues — separate from bed playback). */
  stingerTrack: StingerTrack;
  /** Stingers indexed by id. */
  stingerLibrary: Map<string, Stinger>;
  segments: Segment[];
  /** Current game phase driving the director. */
  phase: GamePhase;
  /** Beat counter for display. */
  beat: number;
  /** Notes for piano roll visualization. */
  noteBuffer: { voice: string; midi: number; velocity: number; beatOffset: number; duration: number }[];
  /** Pre-fade: upcoming phase change we have foreknowledge of. */
  pendingTransition: PendingTransition | null;
  /** Anticipation events we've already fired pre-swells for, keyed by event type.
   *  Value is the wall-clock time of that firing; cleared after the predicted
   *  event lands or a debounce window elapses. */
  anticipationFiredAt: Map<string, number>;
  /** Previous-tick smoothed facets (for temporal smoothing of game-supplied
   *  target facets). Null until first setFullGameState call. */
  prevSheepFacets: SheepFacets | null;
  prevWolfFacets: WolfFacets | null;
  /** Wall-clock time (ms, performance.now() compatible) of the previous
   *  setFullGameState call. Used to compute dt for facet smoothing. */
  prevStateTickMs: number | null;
  /** Set to true once the engine has observed a sheep tick where
   *  `lastAlive=false`. The `hero` bed is the catalogue's "lone sheep
   *  facing the wolf, *earned by attrition*" state — it shouldn't fire
   *  when the player has been alone since round-start (e.g. 1v1, 1vN
   *  modes). Until lastAlive=false has been seen at least once this
   *  round, lastAlive=true is treated as "always alone" and gets the
   *  normal threat-driven cautious/terror progression instead of the
   *  hero shortcut. Reset on each new round (state→lobby boundary). */
  observedNonLastAliveSheep: boolean;
  /** Active recording, if startRecording() was called. The engine pushes
   *  state samples / notes / bed changes / events into it at the relevant
   *  hook points. */
  recorder: Recording | null;
  onTick?: (beat: number, audioTime: number) => void;
  onSegmentChange?: (segId: string, family: string, idx: number, total: number) => void;
}

export function createV3Engine(segments: Segment[]): V3EngineState {
  const engine: V3EngineState = {
    ctx: null,
    clock: null,
    renderer: createRenderer(),
    director: createDirector(segments),
    bedDirector: createBedDirector(),
    stingerTrack: createStingerTrack(),
    stingerLibrary: new Map(),
    segments,
    phase: "intermission-pre",
    beat: 0,
    noteBuffer: [],
    pendingTransition: null,
    anticipationFiredAt: new Map(),
    prevSheepFacets: null,
    prevWolfFacets: null,
    prevStateTickMs: null,
    observedNonLastAliveSheep: false,
    recorder: null,
  };
  // Wire note callbacks here (not in startV3Engine) so offline replay paths
  // — which never call startV3Engine because there's no audio context —
  // still capture notes through the recorder.
  wireNoteCallbacks(engine);
  return engine;
}

/** Wire the renderer + stinger note callbacks into the engine's note buffer
 *  and recorder. Pure function assignments; safe to call from createV3Engine
 *  (offline-friendly, no audio context dependency). */
function wireNoteCallbacks(engine: V3EngineState): void {
  engine.renderer.onNote = (layerId, midi, velocity, beat, duration) => {
    engine.noteBuffer.push({ voice: layerId, midi, velocity, beatOffset: beat, duration });
    if (engine.noteBuffer.length > 5000) {
      engine.noteBuffer.splice(0, engine.noteBuffer.length - 4000);
    }
    if (engine.recorder) {
      recordNote(engine.recorder, engine, layerId, midi, velocity, beat, duration);
    }
  };
  engine.stingerTrack.onNote = (id, midi, velocity, beat, duration) => {
    if (engine.recorder) {
      recordNote(engine.recorder, engine, `stinger:${id}`, midi, velocity, beat, duration);
    }
  };
}

/** Install a Phase-2 bed library; later setFullGameState calls will use it. */
export function installBedLibrary(engine: V3EngineState, library: BedLibrary): void {
  setBedLibrary(engine.bedDirector, library);
}

/**
 * Phase-2 driver: hand the engine a full game state.
 * The bed director picks the right bed and crossfades the renderer.
 * Returns true if a bed change occurred this call.
 */
export function setFullGameState(engine: V3EngineState, state: FullGameState): boolean {
  // Recorder hook: capture the raw input *before* smoothing so replay can
  // pump the same unsmoothed sequence and produce the same smoothed output.
  if (engine.recorder) recordInput(engine.recorder, engine, state);

  // Apply temporal smoothing to game-supplied facets. The game tells us its
  // *target* state per tick; the music's reaction time is decoupled via
  // exponential smoothing in facets.ts. dt is wall-clock between ticks
  // (not beat-locked) since smoothing is musical-feel, not bar-aligned.
  const nowMs = (typeof performance !== "undefined" ? performance.now() : Date.now());
  const dt = engine.prevStateTickMs !== null
    ? Math.max(0.001, (nowMs - engine.prevStateTickMs) / 1000)
    : 0.05;
  engine.prevStateTickMs = nowMs;

  let smoothedState = state;
  if (state.sheep) {
    const smoothed = smoothSheepFacets(state.sheep, engine.prevSheepFacets, dt);
    engine.prevSheepFacets = smoothed;
    smoothedState = { ...smoothedState, sheep: smoothed };
  } else {
    engine.prevSheepFacets = null;
  }
  if (state.wolf) {
    const smoothed = smoothWolfFacets(state.wolf, engine.prevWolfFacets, dt);
    engine.prevWolfFacets = smoothed;
    smoothedState = { ...smoothedState, wolf: smoothed };
  } else {
    engine.prevWolfFacets = null;
  }

  // Reset the "ever saw multiple sheep" tracker between rounds (lobby
  // boundary). Without this, lifetime memory bleeds across rounds and a
  // 1v1 round following a 4v4 round would still allow hero (incorrect).
  // Also advance the bed-director's round index so per-round variant
  // selection rotates to a different bed alternative on the next round.
  if (state.state === "lobby" && engine.bedDirector.currentState !== "lobby") {
    engine.observedNonLastAliveSheep = false;
    advanceRound(engine.bedDirector);
  }

  // "Hero" is the catalogue's "lone sheep earned by attrition" bed; it
  // should NOT fire when the player has been alone since round-start.
  // Track whether we've ever seen lastAlive=false this round; if not,
  // suppress the hero shortcut by overriding lastAlive→false. Bed
  // selection then falls through to the normal threat-driven
  // cautious/terror progression. When this round is multi-team and
  // attrition reduces the team to one, lastAlive=true will engage hero
  // normally (as the catalogue intends).
  if (smoothedState.sheep) {
    if (!smoothedState.sheep.lastAlive) {
      engine.observedNonLastAliveSheep = true;
    } else if (!engine.observedNonLastAliveSheep) {
      smoothedState = {
        ...smoothedState,
        sheep: { ...smoothedState.sheep, lastAlive: false },
      };
    }
  }

  // Drive renderer.mood from smoothed facets. tension feeds the per-layer
  // bleed mechanic (sheep timpani gain, wolf-side sparkle gain). urgency
  // accelerates tempo up to +15% as the round progresses. Energy is left
  // at neutral 0.5 — we have no APM signal, and bed authoring shapes
  // intensity directly via dynamics.
  if (smoothedState.sheep) {
    engine.renderer.mood.tension = smoothedState.sheep.threat;
    engine.renderer.mood.urgency = smoothedState.sheep.roundProgress;
  } else if (smoothedState.wolf) {
    engine.renderer.mood.tension = smoothedState.wolf.proximity;
    engine.renderer.mood.urgency = smoothedState.wolf.roundProgress;
  }

  const oldSeg = engine.renderer.primary?.segment;
  const oldBed = engine.bedDirector.currentBed;
  const seg = applyGameState(engine.bedDirector, smoothedState, engine.renderer);

  // Recorder hook: log a state sample every tick, and a bed-change entry
  // when the director switched beds. Sampling here (rather than at the
  // start of the function) means selection / mix / currentBed reflect what
  // the director just decided in response to this state.
  if (engine.recorder) {
    recordState(engine.recorder, engine, smoothedState);
    if (seg && engine.bedDirector.currentBed !== oldBed) {
      recordBedChange(
        engine.recorder, engine, oldBed, engine.bedDirector.currentBed ?? "(unknown)",
        `${seg.key.root} ${seg.key.mode}`, seg.tempo,
      );
    }
  }

  // Anticipation handling — independent of bed change; runs every tick.
  // Only acts on high-confidence rescues for now. Uses unsmoothed state
  // (anticipation needs the game's certainty, not the music's smoothing).
  handleAnticipation(engine, state);

  if (seg) {
    // Bed-boundary bridge: when crossing a key change, fire a 1-bar tonic+5th
    // pad in the new key as a stinger so bar 1 of the new bed lands on a
    // sustained harmonic halo instead of a bare crossfade seam.
    // Switch and bulldog modes get a softer halo since the wolf entrance
    // there is meant to feel less ceremonial than a standard round.
    if (oldSeg && (oldSeg.key.root !== seg.key.root || oldSeg.key.mode !== seg.key.mode)) {
      const bridge = buildBedBridgeSegment(seg.key.root, seg.key.mode, seg.tempo);
      const bpb = oldSeg.meter[0];
      const startBeat = Math.ceil(engine.beat / bpb) * bpb;
      // Bulldog: wolves spawn together with sheep, no ceremony.
      // Switch: short head start, less dramatic entrance.
      // Vamp: full ceremony — captures = wolf-team-grows is dramatic.
      // Survival/vip: full ceremony.
      const bridgeGain = state.mode === "bulldog" ? 0.25
                       : state.mode === "switch" ? 0.35
                       : 0.55;
      fireStinger(engine.stingerTrack, {
        id: "bed-bridge", trigger: "round-start", segment: bridge, gain: bridgeGain,
      }, startBeat);
    }
    if (engine.clock) engine.clock.tempo = seg.tempo * SUBDIVISION;
    fireSegmentChange(engine);
    return true;
  }
  return false;
}

/** Confidence threshold for committing the rescue pre-swell stinger.
 *  Below this we don't stage musically — the game side might be wrong. */
const RESCUE_PRESWELL_MIN_CONFIDENCE = 0.8;
/** Don't stage a pre-swell shorter than this — too short to be heard as anticipation. */
const RESCUE_PRESWELL_MIN_LEAD = 1.5;
/** And don't make one longer than this — we'd run out of musical material. */
const RESCUE_PRESWELL_MAX_LEAD = 8;
/** Re-arm window: after a pre-swell fires, ignore further anticipation events
 *  of the same type until this many seconds have passed (prevents spam). */
const ANTICIPATION_REARM_SECONDS = 6;

function handleAnticipation(engine: V3EngineState, state: FullGameState): void {
  const events = state.anticipation;
  if (!events || events.length === 0) return;

  const now = performance.now() / 1000;

  // Reap stale firings outside the re-arm window so the same event type can
  // re-fire on the next genuine anticipation cycle.
  for (const [evt, firedAt] of engine.anticipationFiredAt) {
    if (now - firedAt > ANTICIPATION_REARM_SECONDS) {
      engine.anticipationFiredAt.delete(evt);
    }
  }

  for (const ant of events) {
    if (ant.event !== "rescue") continue;
    if (ant.confidence < RESCUE_PRESWELL_MIN_CONFIDENCE) continue;
    if (ant.lead < RESCUE_PRESWELL_MIN_LEAD || ant.lead > RESCUE_PRESWELL_MAX_LEAD) continue;
    if (engine.anticipationFiredAt.has(ant.event)) continue;

    const seg = engine.renderer.primary?.segment;
    const tempo = seg?.tempo ?? 120;
    const bpb = seg?.meter[0] ?? 4;
    const preswell = buildRescuePreswellSegment(ant.lead, tempo);
    const startBeat = Math.ceil(engine.beat / bpb) * bpb;
    fireStinger(engine.stingerTrack, {
      id: "rescue-preswell", trigger: "rescue", segment: preswell, gain: 0.6,
    }, startBeat);
    engine.anticipationFiredAt.set(ant.event, now);
  }
}

/** Register a stinger so it can be fired by id. */
export function registerStinger(engine: V3EngineState, stinger: Stinger): void {
  engine.stingerLibrary.set(stinger.id, stinger);
}

/** Fire a stinger by id at the next beat. Logs a warning if id not found.
 *  Beat-snap (vs bar-snap) keeps narrative cues — capture, rescue,
 *  sheep-loss-fade — under ~0.6s of latency at typical tempos. Bar-snap
 *  produced up to 2.4s of dead air at slow beds (e.g. desperate at 100 BPM,
 *  4/4), which kills the emotional payoff on round-end. Engine-fired
 *  stingers that *do* need bar alignment (bed-bridge, rescue-preswell)
 *  call fireStinger directly with their own bar-aligned startBeat. */
export function fireStingerById(engine: V3EngineState, id: string): void {
  const s = engine.stingerLibrary.get(id);
  if (!s) {
    console.warn(`fireStingerById: no stinger registered with id "${id}"`);
    return;
  }
  const startBeat = Math.ceil(engine.beat);
  fireStinger(engine.stingerTrack, s, startBeat);
}

export async function startV3Engine(engine: V3EngineState): Promise<void> {
  if (!engine.ctx) engine.ctx = new AudioContext();
  if (engine.ctx.state === "suspended") await engine.ctx.resume();
  await loadSF2(engine.ctx);

  engine.renderer = createRenderer(engine.ctx.sampleRate);
  engine.renderer.lookaheadBeats = 1 / SUBDIVISION;
  engine.director = createDirector(engine.segments);
  engine.noteBuffer = [];
  engine.beat = 0;

  // Re-wire note callbacks because we just replaced engine.renderer.
  wireNoteCallbacks(engine);

  // Start director with initial phase
  startDirector(engine.director, engine.renderer, engine.phase);
  fireSegmentChange(engine);

  // Create clock at sub-beat rate
  const seg = engine.renderer.primary?.segment;
  const tempo = seg?.tempo ?? 120;
  engine.clock = createClock(tempo * SUBDIVISION, (subBeat, audioTime) => {
    handleTick(engine, subBeat / SUBDIVISION, audioTime);
  });
  startClock(engine.ctx, engine.clock);
}

function handleTick(engine: V3EngineState, beat: number, audioTime: number): void {
  engine.beat = beat;
  engine.onTick?.(beat, audioTime);

  const now = performance.now() / 1000;

  // Check pre-fade: start crossfade PREFADE_LEAD seconds before the target time
  if (engine.pendingTransition && !engine.pendingTransition.started) {
    const timeUntil = engine.pendingTransition.targetTime - now;
    if (timeUntil <= PREFADE_LEAD) {
      const phase = engine.pendingTransition.phase;
      engine.pendingTransition.started = true;

      const targetFamily = getPhaseFamily(phase, engine.director.perspective);
      if (targetFamily !== engine.director.currentFamily) {
        const seg = switchFamilyForPrefade(engine.director, targetFamily);
        if (seg) {
          const tempo = engine.renderer.primary?.segment.tempo ?? 120;
          const crossfadeBeats = Math.max(2, Math.round((timeUntil * tempo) / 60));
          transitionTo(engine, seg, crossfadeBeats);
        }
      }
    }
  }

  if (engine.pendingTransition?.started) {
    if (now >= engine.pendingTransition.targetTime) {
      engine.phase = engine.pendingTransition.phase;
      engine.director.lastPhase = engine.pendingTransition.phase;
      engine.pendingTransition = null;
    }
  }

  rendererTick(engine.renderer, beat);
  stingerTick(engine.stingerTrack, beat, engine.renderer.lookaheadBeats);

  // Check if current segment has completed a loop → ask director for next
  const player = engine.renderer.primary;
  if (player) {
    const beatInSeg = beat - player.startBeat;
    const totalBeats = player.segment.totalBeats;
    if (beatInSeg >= totalBeats && beatInSeg < totalBeats + 1 / SUBDIVISION + 0.001) {
      const next = onSegmentEnd(engine.director, engine.renderer, engine.phase);
      if (next) {
        transitionTo(engine, next);
      }
    }
  }
}

/** How many seconds before the event to start the pre-fade. */
const PREFADE_LEAD = 3;

/**
 * Signal that a phase change is coming in `secondsFromNow`.
 * The engine will start crossfading early so the new music
 * is already warm when the moment hits.
 */
export function preparePhase(engine: V3EngineState, phase: GamePhase, secondsFromNow: number): void {
  if (phase === engine.phase) return;
  engine.pendingTransition = {
    phase,
    targetTime: performance.now() / 1000 + secondsFromNow,
    started: false,
  };
}

/** Crossfade durations by transition type. */
const CROSSFADE_BEATS: Partial<Record<GamePhase, number>> = {
  "early": 2,           // wolves spawn — quick shadow
  "spirit": 1,          // capture — near-instant
  "rescue": 2,          // rescue — quick lift
  "last-stand": 2,      // dramatic shift
  "victory": 1,         // climax hit
  "victory-build": 3,   // build starts
  "round-end-wolves": 2,
  "defeat-build": 3,
  "intermission-pre": 3,
  "intermission-between": 3,
};

/** Set the player's perspective (sheep/wolf/spirit). */
export function setPerspective(engine: V3EngineState, perspective: Perspective): void {
  engine.director.perspective = perspective;
}

/** Change the game phase. The director decides if/when to switch music. */
export function setPhase(engine: V3EngineState, phase: GamePhase): void {
  if (phase === engine.phase) return;
  engine.phase = phase;
  // Cancel any pending pre-fade — this is the real transition now
  engine.pendingTransition = null;

  const seg = onPhaseChange(engine.director, engine.renderer, phase);
  if (seg) {
    const crossfade = CROSSFADE_BEATS[phase] ?? 4;
    transitionTo(engine, seg, crossfade);
  }
}

/** Skip to next segment within the current family. */
export function nextSegment(engine: V3EngineState): void {
  const next = onSegmentEnd(engine.director, engine.renderer, engine.phase);
  if (next) {
    transitionTo(engine, next);
  }
}

/** Skip to next family (cycles through all families). */
export function nextFamily(engine: V3EngineState): void {
  const allFamilies = [...engine.director.families.keys()];
  const currentIdx = allFamilies.indexOf(engine.director.currentFamily);
  const nextIdx = (currentIdx + 1) % allFamilies.length;
  const nextFam = allFamilies[nextIdx];

  // Find a phase that maps to this family, or just switch directly
  const segments = engine.director.families.get(nextFam);
  if (segments && segments.length > 0) {
    engine.director.currentFamily = "";  // force switchFamily in onSegmentEnd
    // Directly set the family
    const seg = segments[Math.floor(Math.random() * segments.length)];
    engine.director.currentFamily = nextFam;
    engine.director.currentSegmentId = seg.id;
    engine.director.playlist = segments.map((_, i) => i);
    engine.director.playlistIndex = 0;
    transitionTo(engine, seg);
  }
}

function transitionTo(engine: V3EngineState, seg: Segment, crossfadeBeats?: number): void {
  playSegment(engine.renderer, seg, 0, crossfadeBeats);
  fireSegmentChange(engine);

  // Update clock tempo
  if (engine.clock) {
    engine.clock.tempo = seg.tempo * SUBDIVISION;
  }
}

function fireSegmentChange(engine: V3EngineState): void {
  const seg = engine.renderer.primary?.segment;
  if (!seg) return;
  const family = engine.director.currentFamily;
  const familySegs = engine.director.families.get(family) ?? [];
  const idx = familySegs.findIndex(s => s.id === seg.id);
  engine.onSegmentChange?.(seg.id, family, idx + 1, familySegs.length);
}

/** Mute/unmute a layer by role name. */
export function setV3Muted(engine: V3EngineState, role: string, muted: boolean): void {
  if (muted) {
    engine.renderer.mutedLayers.add(role);
  } else {
    engine.renderer.mutedLayers.delete(role);
  }
}

export function stopV3Engine(engine: V3EngineState): void {
  if (engine.clock) stopClock(engine.clock);
  stopAll(engine.renderer);
  stopAllStingers(engine.stingerTrack);
  allNotesOff();
  engine.clock = null;
}

export function pauseV3Engine(engine: V3EngineState): void {
  if (engine.clock) stopClock(engine.clock);
  allNotesOff();
}

export async function resumeV3Engine(engine: V3EngineState): Promise<void> {
  if (!engine.ctx) engine.ctx = new AudioContext();
  if (engine.ctx.state === "suspended") await engine.ctx.resume();
  await loadSF2(engine.ctx);
  if (engine.clock) {
    startClock(engine.ctx, engine.clock);
  }
}
