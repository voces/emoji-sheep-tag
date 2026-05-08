/**
 * Bed director: facets → bed selection → renderer playback.
 *
 * Replaces the family/phase logic in director.ts for Phase 2 work.
 * Reads FullGameState, calls selectSheepBedWithBlend / selectWolfBedWithBlend,
 * and drives the renderer to play / crossfade between beds.
 */

import {
  type FullGameState, type BedId, type StructuralBedId, type StructuralState,
  type Segment, type Layer, type NoteEvent, type GameMode,
} from "./types.ts";
import { type BedLibrary } from "./bedLibrary.ts";
import { type BedSelection } from "./beds.ts";
import { selectSheepBedWithBlend, selectWolfBedWithBlend } from "./beds.ts";
import { type RendererState, playSegment, stopAll } from "./renderer.ts";
import { computeSheepMix, computeWolfMix, type MixState } from "./modulation.ts";

/**
 * Structural-state beds. Indexed by id outside the BedId enum.
 * Stored in the same library map; this is just the set of well-known ids.
 *
 * Build beds are mode-keyed because each game mode has a fixed build-phase
 * length (bulldog 2s, switch 5s, survival/vip/vamp 21s) and the bed is
 * authored to land its final wolf-spawn cadence exactly at the end. The
 * build→active transition then needs no crossfade — the bed has already
 * delivered the spawn moment, and active begins on the next tick.
 *
 * Practice mode is not represented here: the game stays in "lobby" through
 * a practice round, so the lobby bed simply continues.
 */
export const STRUCTURAL_BED_IDS = {
  lobby: "lobby",
  buildSheepBulldog: "build-sheep-bulldog",
  buildWolfBulldog: "build-wolf-bulldog",
  buildSheepSwitch: "build-sheep-switch",
  buildWolfSwitch: "build-wolf-switch",
  buildSheepSurvival: "build-sheep-survival",
  buildWolfSurvival: "build-wolf-survival",
} as const;

/** Pick the build bed id for a given perspective + mode. vip/vamp/undefined fall
 *  through to the survival bed (same 21s timing). */
function buildBedFor(perspective: "sheep" | "wolf", mode: GameMode | undefined): StructuralBedId {
  const m = mode ?? "survival";
  if (m === "bulldog") {
    return perspective === "wolf" ? STRUCTURAL_BED_IDS.buildWolfBulldog : STRUCTURAL_BED_IDS.buildSheepBulldog;
  }
  if (m === "switch") {
    return perspective === "wolf" ? STRUCTURAL_BED_IDS.buildWolfSwitch : STRUCTURAL_BED_IDS.buildSheepSwitch;
  }
  return perspective === "wolf" ? STRUCTURAL_BED_IDS.buildWolfSurvival : STRUCTURAL_BED_IDS.buildSheepSurvival;
}

/** Crossfade durations by transition type (in beats).
 *
 *  Structural and hard switches use beat-snap (in `playSegment(... "beat")`)
 *  so they react within ~1 beat of the state change rather than waiting up
 *  to a full bar. Combined with the shorter STRUCTURAL crossfade below,
 *  this keeps wolf-spawn-class moments under ~3 beats end-to-end instead
 *  of the previous ~5-second worst case (bar-snap + 4-beat crossfade).
 *
 *  Parametric threat-driven crossfades still use bar-snap because they're
 *  smooth gradients, not moments — phrase alignment matters more than
 *  responsiveness. */
const CROSSFADE_BLEND = 8;     // parametric threat-driven crossfade
const CROSSFADE_HARD = 2;      // discrete switch (capture, last-alive, failing)
const CROSSFADE_STRUCTURAL = 2; // structural state change (was 4 — too slow with bar-snap)

/** Minimum beats we'll stay on a parametric bed before allowing another
 *  parametric flip. The blend-zone-based hysteresis below only fires inside
 *  the ±BLEND_WIDTH band (0.08); when threat oscillates *across* the band
 *  (e.g. proximity 0.55 ↔ 0.78 every few seconds), each crossing is a
 *  decisive deep-region selection so the blend-zone guard is bypassed. The
 *  result is bed thrashing — we observed 7 cautious↔terror flips in a
 *  30-beat window. Dwell-time hysteresis suppresses any *parametric* flip
 *  until the new bed has had a chance to actually be heard. Hard switches
 *  (alive→spirit, lastAlive→hero, wolf failing→desperate) bypass this —
 *  they're event-driven and the listener expects an immediate response.
 *
 *  16 beats = 4 bars at 4/4. Picked to be longer than the 8-beat blend
 *  crossfade so the new bed has a full bar at full volume before being
 *  eligible to be replaced. */
const MIN_DWELL_BEATS = 16;

export interface BedDirectorState {
  library: BedLibrary | null;
  /** Currently playing bed id (BedId for active beds, structural id for lobby/build). */
  currentBed: string | null;
  /** Renderer beat at which currentBed last became current. Used for the
   *  MIN_DWELL_BEATS hysteresis: parametric flips require the current bed
   *  to have been on for at least that many beats. */
  currentBedSinceBeat: number;
  /** Last structural state we responded to. */
  currentState: StructuralState | null;
  /** Last facet snapshot (for diagnostic / debugging). */
  lastSelection: BedSelection | null;
  /** Last mix state applied (for diagnostic / UI display). */
  lastMix: MixState | null;
  /** Variant selections cached for the current round. Picked deterministically
   *  from sessionSeed + roundIndex + bedId at first lookup; held for the
   *  whole round so the same bed plays the same variant if re-entered. */
  variantCache: Map<string, number>;
  /** Monotonic round counter, incremented each lobby boundary. Combined with
   *  sessionSeed so different rounds in the same session pick different
   *  variants (cycling through alternatives across rounds). */
  roundIndex: number;
}

export function createBedDirector(): BedDirectorState {
  return {
    library: null,
    currentBed: null,
    currentBedSinceBeat: 0,
    currentState: null,
    lastSelection: null,
    lastMix: null,
    variantCache: new Map(),
    roundIndex: 0,
  };
}

/** djb2 string hash; stable across runs. Same as renderer.ts. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h >>> 0;
}

/** Pick a song-set tag for the round. Songs are deterministic from
 *  sessionSeed + roundIndex, so every bed picked in this round agrees on
 *  the song. The set of available songs is the union of `segment.song`
 *  values across all segments in the library. If only "base" exists,
 *  every round picks "base" trivially.
 *
 *  Returns "base" if the library is empty or has only base segments. */
export function pickSongForRound(
  director: BedDirectorState,
  sessionSeed: string,
): string {
  const lib = director.library;
  if (!lib) return "base";
  // Union of song tags across all variants in the library.
  const songs = new Set<string>();
  for (const variants of lib.beds.values()) {
    for (const seg of variants) songs.add(seg.song);
  }
  if (songs.size <= 1) return "base";
  // Sort for stable ordering, then index by hash. Round-robin over
  // (sessionSeed, roundIndex) ensures different rounds in the same
  // session pick different songs.
  const sorted = [...songs].sort();
  const idx = hashString(`${sessionSeed}/${director.roundIndex}/song`) % sorted.length;
  return sorted[idx];
}

/** Pick a variant for the given bed id. Cached per (bedId, round). When
 *  multiple variants exist, prefer the one tagged with the round's song
 *  (computed from sessionSeed + roundIndex). If no variant matches,
 *  fall back to a deterministic pick across all variants — same session+
 *  round picks the same fallback every time. */
export function pickVariant(
  director: BedDirectorState,
  bedId: string,
  sessionSeed: string,
): Segment | null {
  const variants = director.library?.beds.get(bedId as BedId);
  if (!variants || variants.length === 0) return null;
  if (variants.length === 1) return variants[0];

  const cached = director.variantCache.get(bedId);
  if (cached !== undefined && cached < variants.length) return variants[cached];

  // Filter to variants matching this round's song. If none match, fall
  // back to all variants — older beds without a song-set still rotate.
  const targetSong = pickSongForRound(director, sessionSeed);
  const matching = variants.filter(v => v.song === targetSong);
  const pool = matching.length > 0 ? matching : variants;

  // Within the pool, hash-pick deterministically. Including bedId in the
  // hash means different beds in the same round can still pick different
  // members of the pool (matters when multiple variants share a song).
  const poolIdx = hashString(`${sessionSeed}/${director.roundIndex}/${bedId}`) % pool.length;
  const chosen = pool[poolIdx];
  // Cache the index in the original variants[] so re-entry hits the same.
  director.variantCache.set(bedId, variants.indexOf(chosen));
  return chosen;
}

/** Mark a round boundary — clears the variant cache and increments the
 *  round counter so the next round picks fresh variants. Call from the
 *  engine on lobby→build (or another round-start) transitions.
 *
 *  Also resets the dwell-time hysteresis: a new round shouldn't be
 *  constrained by how long the previous round's last bed had been
 *  playing. Without this reset, the first parametric bed selection of
 *  round N+1 would be suppressed for MIN_DWELL_BEATS after the lobby
 *  transition. */
export function advanceRound(director: BedDirectorState): void {
  director.variantCache.clear();
  director.roundIndex++;
  director.currentBedSinceBeat = -Infinity;
}

export function setBedLibrary(director: BedDirectorState, library: BedLibrary): void {
  director.library = library;
}

const ROOT_PC: Record<string, number> = {
  "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4,
  "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8,
  "A": 9, "A#": 10, "Bb": 10, "B": 11,
};

/** Pre-swell stinger: a sustained dominant chord in the parallel-key dominant
 *  (D major when target = G or Gm) that crescendos over `leadSeconds` beats and
 *  lands at the resolution moment. Used to *stage* a rescue ahead of time —
 *  the actual rescue stinger resolves what this pre-swell sets up.
 *
 *  Voicing is rooted on D (V of G/Gm) and uses raised 7th for major-leading
 *  feel. Pulsing string tremolo on the high D drives the crescendo. */
export function buildRescuePreswellSegment(
  leadSeconds: number,
  tempo: number,
): Segment {
  const beats = Math.max(2, Math.round((leadSeconds * tempo) / 60));
  const bars = Math.max(1, Math.ceil(beats / 4));
  const totalBeats = bars * 4;

  // Sustained D-major triad held for the full duration.
  const padNotes: NoteEvent[] = [
    { beat: 0, midi: 50, duration: totalBeats, velocity: 0.30 }, // D3
    { beat: 0, midi: 62, duration: totalBeats, velocity: 0.32 }, // D4
    { beat: 0, midi: 66, duration: totalBeats, velocity: 0.30 }, // F#4
    { beat: 0, midi: 69, duration: totalBeats, velocity: 0.30 }, // A4
  ];
  const pad: Layer = {
    id: "preswell-pad", role: "pad", instrument: 48, priority: 1, notes: padNotes,
  };

  // Pulsing tremolo on high D with rising velocity (pp → mf).
  const tremNotes: NoteEvent[] = [];
  for (let b = 0; b < totalBeats; b++) {
    const t = totalBeats > 1 ? b / (totalBeats - 1) : 1;
    const vel = 0.20 + t * 0.55;
    tremNotes.push({ beat: b, midi: 74, duration: 0.95, velocity: vel }); // D5 quarter pulse
  }
  const trem: Layer = {
    id: "preswell-trem", role: "melody", instrument: 44, priority: 1, notes: tremNotes,
  };

  return {
    id: "rescue-preswell",
    family: "stinger",
    key: { root: "G", mode: "minor" },
    tempo,
    meter: [4, 4],
    bars,
    totalBeats,
    layers: [pad, trem],
    tags: [],
    transitions: [],
    song: "base",
  };
}

/** Generate a 1-bar tonic+fifth pad segment in the target key/tempo. Used as
 *  a bed-boundary bridge: fired as a stinger when the bed director switches
 *  beds across a key change, providing a smooth harmonic landing for bar 1
 *  of the new bed. */
export function buildBedBridgeSegment(
  root: string,
  mode: string,
  tempo: number,
): Segment {
  const pc = ROOT_PC[root] ?? 0;
  const tonic4 = 60 + pc;        // tonic at octave 4
  const fifth4 = tonic4 + 7;     // perfect fifth above (works in major and minor)
  const tonic3 = tonic4 - 12;    // sub-octave for body
  const layer: Layer = {
    id: "bridge-pad",
    role: "pad",
    instrument: 48, // strings
    priority: 1,
    notes: [
      { beat: 0, midi: tonic3, duration: 4, velocity: 0.42 },
      { beat: 0, midi: tonic4, duration: 4, velocity: 0.45 },
      { beat: 0, midi: fifth4, duration: 4, velocity: 0.42 },
    ],
  };
  return {
    id: "bed-bridge",
    family: "stinger",
    key: { root, mode },
    tempo,
    meter: [4, 4],
    bars: 1,
    totalBeats: 4,
    layers: [layer],
    tags: [],
    transitions: [],
    song: "base",
  };
}

/**
 * Apply a new game state to the director. Decides whether to switch beds
 * and tells the renderer to play the new bed (with appropriate crossfade)
 * if so. Returns the segment that became active, or null if nothing changed.
 */
export function applyGameState(
  director: BedDirectorState,
  state: FullGameState,
  renderer: RendererState,
): Segment | null {
  if (!director.library) return null;

  // Structural state: Lobby, Build → play their dedicated beds.
  // Beat-snap (not bar) so structural transitions react within ~1 beat
  // of the game's state change rather than up to a full bar later.
  if (state.state === "lobby") {
    if (director.currentBed === STRUCTURAL_BED_IDS.lobby && director.currentState === "lobby") return null;
    const seg = pickVariant(director, STRUCTURAL_BED_IDS.lobby, renderer.sessionSeed);
    if (!seg) return null;
    playSegment(renderer, seg, 0, CROSSFADE_STRUCTURAL, "beat");
    director.currentBed = STRUCTURAL_BED_IDS.lobby;
    director.currentBedSinceBeat = renderer.currentBeat;
    director.currentState = "lobby";
    return seg;
  }

  if (state.state === "build") {
    const persp: "sheep" | "wolf" = state.perspective === "wolf" ? "wolf" : "sheep";
    const buildId = buildBedFor(persp, state.mode);
    if (director.currentBed === buildId && director.currentState === "build") return null;
    const seg = pickVariant(director, buildId, renderer.sessionSeed);
    if (!seg) return null;
    // Sheep side: hard cut into the build bed (alert players the round is starting).
    // Wolf side: smooth crossfade from lobby — wolves have plenty of downtime,
    // no need for a startle cue.
    if (persp === "sheep") {
      playSegment(renderer, seg, 0, 0, "now");
    } else {
      playSegment(renderer, seg, 0, CROSSFADE_STRUCTURAL, "beat");
    }
    director.currentBed = buildId;
    director.currentBedSinceBeat = renderer.currentBeat;
    director.currentState = "build";
    return seg;
  }

  // Active — fall through to facet-driven bed selection.
  // Vamp special case: a captured sheep converts to wolf immediately, so the
  // game side will re-issue with perspective "wolf" within a frame. If we ever
  // observe a !alive sheep state in vamp mode (transient or game-side stall),
  // hold the previous bed instead of jumping to spirit — there's no spirit
  // phase in vamp.
  if (state.mode === "vamp" && state.sheep && !state.sheep.alive) {
    return null;
  }

  // Compute bed selection AND modulation mix
  let selection: BedSelection;
  let mix: MixState;
  if (state.perspective === "wolf" && state.wolf) {
    selection = selectWolfBedWithBlend(state.wolf);
    mix = computeWolfMix(state.wolf, state.mode);
  } else if ((state.perspective === "sheep" || state.perspective === "spirit") && state.sheep) {
    selection = selectSheepBedWithBlend(state.sheep);
    mix = computeSheepMix(state.sheep);
  } else {
    return null;
  }

  director.lastSelection = selection;
  director.lastMix = mix;

  // Apply modulation to the renderer's currently-playing layers.
  // This is per-layer-id; layer ids in our beds are the role names.
  if (renderer.primary) {
    for (const lp of renderer.primary.layers) {
      const factor = mix.layerGains.get(lp.layer.id) ?? 1;
      lp.targetGain = factor;
      lp.gain = factor;
    }
  }

  // Two-stage hysteresis suppresses parametric bed thrashing.
  //
  // Stage 1 (blend-zone): inside the ±BLEND_WIDTH band, `selection.primary`
  // flips at the midpoint. Hold currentBed when the new primary is just
  // the secondary side of a midpoint crossing and we haven't moved far
  // past it (blend > HYSTERESIS_BLEND means upper half of blend zone).
  // This catches small jitter near a single threshold.
  //
  // Stage 2 (dwell-time): when threat oscillates *across* the entire band
  // (e.g. proximity 0.55 ↔ 0.78 every few seconds), each crossing is a
  // decisive deep-region selection so stage 1 doesn't engage. Require
  // currentBed to have played for at least MIN_DWELL_BEATS before any
  // parametric flip is allowed. Hard switches (alive/lastAlive/failing)
  // bypass — they're event-driven and need immediate response.
  const HYSTERESIS_BLEND = 0.5;
  let targetBed: BedId = selection.primary;
  if (
    director.currentState === "active" &&
    director.currentBed !== null &&
    targetBed !== director.currentBed
  ) {
    const inBlendHold =
      selection.secondary === director.currentBed &&
      selection.blend > HYSTERESIS_BLEND;
    const dwellBeats = renderer.currentBeat - director.currentBedSinceBeat;
    const inDwellHold = !selection.hardSwitch && dwellBeats < MIN_DWELL_BEATS;
    if (inBlendHold || inDwellHold) {
      targetBed = director.currentBed as BedId;
    }
  }

  // Same bed? Nothing to do.
  if (targetBed === director.currentBed && director.currentState === "active") {
    return null;
  }

  const seg = pickVariant(director, targetBed, renderer.sessionSeed);
  if (!seg) {
    console.warn(`bedDirector: no segment for bed "${targetBed}"`);
    return null;
  }

  // Pick crossfade duration and snap policy.
  // - Parametric blends (smooth gradients) → phrase-snap, longer crossfade.
  //   Waits for the outgoing bed's next 4-bar phrase boundary so the cut
  //   doesn't truncate a phrase mid-line. Worst-case wait ~4 bars at the
  //   active tempo (~7s at 130 BPM). Combined with hysteresis at the
  //   selection level, this means parametric bed swaps land on musically
  //   coherent boundaries instead of arbitrary bar lines.
  // - Hard switches (capture/last-alive/failing) → beat-snap, short
  //   crossfade. These are *events* — players expect immediate response.
  // - build → active: no crossfade, no snap. The build bed has already
  //   authored the wolf-spawn cadence as its final gesture — the active
  //   bed picks up immediately on the next tick. Crossfading would smear
  //   the spawn moment we just landed.
  // - lobby → active (practice / unusual): structural fallback.
  let crossfade: number = CROSSFADE_BLEND;
  let snap: "phrase" | "bar" | "beat" | "now" = "phrase";
  if (selection.hardSwitch) {
    crossfade = CROSSFADE_HARD;
    snap = "beat";
  }
  if (director.currentState === "build") {
    crossfade = 0;
    snap = "now";
  } else if (director.currentState !== "active") {
    crossfade = CROSSFADE_STRUCTURAL;
    snap = "beat";
  }

  playSegment(renderer, seg, 0, crossfade, snap);
  director.currentBed = targetBed;
  director.currentBedSinceBeat = renderer.currentBeat;
  director.currentState = state.state;
  return seg;
}
