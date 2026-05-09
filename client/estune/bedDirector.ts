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

/** Compute the next authored transition-hint bar (in absolute beats) for the
 *  outgoing primary segment, at or after `currentBeat`. Returns null if the
 *  segment has no transitions or the next hint falls beyond `maxBeats` —
 *  caller commits immediately in that case.
 *
 *  Hints are bar-indexed within the segment loop; we project them across the
 *  current loop iteration first, then the next, picking the earliest whose
 *  beat is >= currentBeat. */
function nextTransitionBeat(
  primary: { segment: Segment; startBeat: number } | null,
  currentBeat: number,
  maxBeats: number = CADENCE_DEFER_MAX_BEATS,
): number | null {
  if (!primary) return null;
  const seg = primary.segment;
  if (seg.transitions.length === 0) return null;
  const bpb = seg.meter[0];
  // Translate currentBeat into the segment's local beat frame, modulo the
  // segment's loop length, then find the next transition-hint bar.
  const elapsed = currentBeat - primary.startBeat;
  const localBeat = ((elapsed % seg.totalBeats) + seg.totalBeats) % seg.totalBeats;
  let bestDelta = Infinity;
  for (const t of seg.transitions) {
    const hintBeat = t.bar * bpb;
    let delta = hintBeat - localBeat;
    if (delta <= 0) delta += seg.totalBeats; // wrap into the next loop
    if (delta < bestDelta) bestDelta = delta;
  }
  if (!isFinite(bestDelta)) return null;
  if (bestDelta > maxBeats) return null;
  return currentBeat + bestDelta;
}

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

/** Pick the endgame bed id for a given perspective + mode, or null if no
 *  endgame variant exists for that combination. vamp has no time-based win
 *  and gets no endgame routing. All four returned ids are members of the
 *  BedId union — the caller still checks `library.beds.has(...)` because
 *  not every BedId is necessarily *registered* (e.g. bulldog endgame beds
 *  aren't authored yet, so they're absent from the default library; the
 *  caller falls through to threat-driven routing in that case). */
function endgameBedFor(
  perspective: "sheep" | "wolf" | "spirit",
  mode: GameMode | undefined,
): BedId | null {
  const persp = perspective === "wolf" ? "wolf" : "sheep";
  const m = mode ?? "survival";
  if (m === "vamp") return null;
  if (m === "bulldog") {
    return persp === "wolf" ? "endgame-wolf-bulldog" : "endgame-sheep-bulldog";
  }
  // survival, vip, switch all share the survival endgame for now — they're
  // all "sheep win on timer" modes (vip/switch ending conditions are early-
  // out; the timer-expiry path is the survival path).
  return persp === "wolf" ? "endgame-wolf-survival" : "endgame-sheep-survival";
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

/** Max beats we'll defer a parametric bed switch waiting for the current
 *  bed's next authored transition-hint bar (`bar N phrase-end ...`). If no
 *  hint lands within this window, we commit immediately rather than smearing
 *  reactivity. 4 beats ≈ 1 bar in 4/4 ≈ ~1.8s at 130 BPM — long enough to
 *  catch an upcoming phrase-end, short enough that the bed change still
 *  feels reactive to the underlying facet shift. */
const CADENCE_DEFER_MAX_BEATS = 4;

/** Max beats we'll defer the endgame override waiting for the source bed's
 *  next authored transition-hint bar. Endgame opens at 30s remaining and
 *  plays for the rest of the round, so trading a few beats of timing slack
 *  to land the source bed's cadence is essentially free musically. 16 beats
 *  ≈ 4 bars at 4/4 ≈ ~7s at 130 BPM — covers any source bed's next
 *  phrase-end without delaying the endgame past audibility. */
const ENDGAME_CADENCE_MAX_BEATS = 16;

/** Suppress-imminent-override window (seconds): if the endgame window will
 *  open within this many seconds, we hold the current bed instead of taking
 *  a brief threat-driven detour that the override would steamroll. Without
 *  this, an in-round threat dip a few seconds before the 30s-remaining mark
 *  produces a ~5s cautious wedge between the previous bed and the endgame
 *  bed — observed in pair-1 sheep recording. Picked to cover the case where
 *  a parametric flip and the override coincide within ~MIN_DWELL_BEATS
 *  worth of time at typical tempos. */
const ENDGAME_IMMINENT_SECONDS = 8;

/** Mode-aware end-of-round window (seconds), mirroring the engine.ts
 *  helper of the same name. The bed director uses this both for the
 *  endgame override (already gated on `mood.roundFinal > 0`) and the
 *  suppress-imminent-override check below. Kept in sync with engine.ts;
 *  duplicated rather than imported because engine.ts depends on this
 *  module (avoid circular import). */
function endgameWindowSeconds(mode: GameMode | undefined): number {
  switch (mode) {
    case "bulldog": return 10;
    case "vamp":    return 0;
    default:        return 30;
  }
}

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
  /** Pending facet-driven bed switch waiting to land on a phrase-end bar.
   *  Set when an in-active parametric flip is requested within
   *  CADENCE_DEFER_MAX_BEATS of the outgoing bed's next transition-hint
   *  bar; cleared on commit, on structural transition, or when a later
   *  selection overrides the deferred target. */
  pendingBedSwitch: { targetBed: BedId; atBeat: number } | null;
  /** Engine-derived round progress (0..1) computed from FullGameState's
   *  roundElapsedSeconds / roundDurationSeconds. The harness no longer
   *  carries roundProgress on facets; the engine writes this here each
   *  setFullGameState call so applyGameState (and isWolfFailing
   *  downstream) can read a single source of truth. */
  derivedProgress: number;
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
    pendingBedSwitch: null,
    derivedProgress: 0,
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

  // Strict round-robin within the pool, offset per (session, bedId). The
  // hash decides each session's starting variant per bed; +roundIndex
  // walks one step per round so consecutive rounds always pick different
  // pool members. Necessary for back-to-back-round lobby intermissions to
  // feel fresh — a pure hash of (seed/round/bedId) clusters with 2-variant
  // pools.
  const startIdx = hashString(`${sessionSeed}/${bedId}`) % pool.length;
  const poolIdx = (startIdx + director.roundIndex) % pool.length;
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
  director.pendingBedSwitch = null;
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

/** Bed-bridge voicing selection.
 *  - "pivot":    key-change transitions; voicing includes a source-tonic
 *                pivot tone so the listener hears the modulation as a
 *                resolution rather than a hard switch.
 *  - "rising":   same-key escalation (e.g. cautious → terror); voicing
 *                centred at tonic4-tonic5 lifts the register, anticipating
 *                more intensity to come.
 *  - "falling":  same-key de-escalation (e.g. terror → cautious); voicing
 *                centred at tonic2-tonic3 settles the register.
 *  - "standard": neutral / unknown; same-key with similar intensity.
 *
 *  Without this variation, all same-key bridges in a wolf-side round
 *  (which is all-Em) used the identical [E2,E4,B4] halo and read as an
 *  engine cue rather than a musical seam by the 4th-5th fire. */
type BridgeVoicing = "pivot" | "rising" | "falling" | "standard";

/** Pick the voicing for a bed-bridge given the source/destination beds.
 *  - Different tonic or mode: pivot (key-change handling).
 *  - Same key + escalation (destAvgVel > sourceAvgVel + threshold): rising.
 *  - Same key + de-escalation (destAvgVel < sourceAvgVel - threshold): falling.
 *  - Same key + similar intensity: standard. */
function pickBridgeVoicing(
  sourceRoot: string, sourceMode: string, sourceAvgVel: number,
  destRoot: string,   destMode: string,   destAvgVel: number,
): BridgeVoicing {
  const sourcePc = ROOT_PC[sourceRoot] ?? 0;
  const destPc = ROOT_PC[destRoot] ?? 0;
  if (sourcePc !== destPc || sourceMode !== destMode) return "pivot";
  const delta = destAvgVel - sourceAvgVel;
  // 0.06 ≈ one dynamic step (mp→mf is roughly 0.10 in our authoring); keeps
  // jitter from flipping the voicing on near-equal beds.
  if (delta > 0.06) return "rising";
  if (delta < -0.06) return "falling";
  return "standard";
}

/** Generate a 1-bar pad segment in the target key/tempo, as a stinger that
 *  cushions the seam between two beds. Voicing varies with transition
 *  direction (see `pickBridgeVoicing`) so consecutive bridges in the same
 *  round don't sound identical. */
export function buildBedBridgeSegment(
  targetRoot: string,
  targetMode: string,
  tempo: number,
  sourceRoot: string = targetRoot,
  sourceMode: string = targetMode,
  sourceAvgVel: number = 0.43,
  destAvgVel: number = 0.43,
): Segment {
  const pc = ROOT_PC[targetRoot] ?? 0;
  const sourcePc = ROOT_PC[sourceRoot] ?? pc;
  const tonic4 = 60 + pc;
  const fifth4 = tonic4 + 7;
  const tonic3 = tonic4 - 12;
  const tonic2 = tonic4 - 24;
  const tonic5 = tonic4 + 12;
  const fifth3 = fifth4 - 12;
  const fifth2 = fifth4 - 24;

  const voicing = pickBridgeVoicing(
    sourceRoot, sourceMode, sourceAvgVel,
    targetRoot, targetMode, destAvgVel,
  );

  let pitches: number[];
  switch (voicing) {
    case "pivot": {
      // Two pivot cases:
      //   - Different tonic (e.g. Em → Gmaj): voice includes source tonic
      //     as a held pivot tone that the destination key recontextualizes.
      //   - Same tonic, mode change (e.g. G → Gm): voice the new mode's
      //     3rd (Bb for Gm vs B for Gmaj) so the listener hears the mode
      //     shift in the bridge itself rather than only when the new bed
      //     enters underneath.
      const sourceTonic4 = 60 + sourcePc;
      const newThird4 = tonic4 + (targetMode === "minor" ? 3 : 4);
      pitches = sourcePc === pc
        ? [tonic3, newThird4, fifth4]
        : [tonic3, fifth3, sourceTonic4];
      break;
    }
    case "rising":
      pitches = [tonic4, fifth4, tonic5];
      break;
    case "falling":
      pitches = [tonic2, fifth2, tonic3];
      break;
    case "standard":
    default:
      pitches = [tonic3, tonic4, fifth4];
      break;
  }

  const layer: Layer = {
    id: "bridge-pad",
    role: "pad",
    instrument: 48, // strings
    priority: 1,
    notes: pitches.map((midi, i) => ({
      // Centre note at slightly higher velocity so the voicing reads as
      // a chord rather than three independent lines.
      beat: 0, midi, duration: 4,
      velocity: i === Math.floor(pitches.length / 2) ? 0.45 : 0.42,
    })),
  };
  return {
    id: "bed-bridge",
    family: "stinger",
    key: { root: targetRoot, mode: targetMode },
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
    director.pendingBedSwitch = null;
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
    director.pendingBedSwitch = null;
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
    selection = selectWolfBedWithBlend(state.wolf, director.derivedProgress);
    mix = computeWolfMix(state.wolf, state.mode);
  } else if ((state.perspective === "sheep" || state.perspective === "spirit") && state.sheep) {
    selection = selectSheepBedWithBlend(state.sheep);
    mix = computeSheepMix(state.sheep);
  } else {
    return null;
  }

  // Suppress-imminent-override: if a parametric flip would happen within
  // ENDGAME_IMMINENT_SECONDS of the endgame override opening, hold the
  // current bed instead. Without this, an in-round threat dip a few seconds
  // before the 30s-remaining mark produces a brief threat-driven detour
  // that the override steamrolls in seconds — observed in pair-1 sheep as
  // a 5.5s cautious wedge between terror and endgame-sheep-survival. The
  // override below still fires when `roundFinal > 0`, by which time
  // `untilEndgame` is ≤ 0 so this branch is inert.
  if (
    state.state === "active" &&
    !selection.hardSwitch &&
    director.currentBed !== null &&
    selection.primary !== director.currentBed
  ) {
    const elapsedSec = state.roundElapsedSeconds;
    const durationSec = state.roundDurationSeconds;
    const window = endgameWindowSeconds(state.mode);
    if (
      typeof elapsedSec === "number" &&
      typeof durationSec === "number" &&
      durationSec > 0 &&
      window > 0
    ) {
      const untilEndgame = (durationSec - elapsedSec) - window;
      if (untilEndgame > 0 && untilEndgame <= ENDGAME_IMMINENT_SECONDS) {
        selection = {
          primary: director.currentBed as BedId,
          secondary: null,
          blend: 0,
          hardSwitch: false,
        };
      }
    }
  }

  // Endgame override: when the engine-derived round-final bleed signal has
  // begun ramping (mode-aware window), override the threat-driven primary
  // with the perspective+mode-keyed endgame bed. Hard-switch so the swap
  // lands at the window onset rather than waiting for dwell. The standard
  // CROSSFADE_BLEND below ramps the new bed in over ~7s — that crossfade
  // IS the audible build into the round's end. Only fires when the bed
  // actually exists in the library; missing endgame variants (e.g. bulldog
  // beds before they're authored) fall back to the threat-driven choice.
  if (renderer.mood.roundFinal > 0) {
    const endgameId = endgameBedFor(state.perspective, state.mode);
    if (endgameId && director.library?.beds.has(endgameId)) {
      selection = { primary: endgameId, secondary: null, blend: 0, hardSwitch: true };
    }
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

  // Cadence-snap deferral: if a facet-driven flip is requested mid-active
  // and the outgoing bed has an authored transition-hint bar within
  // CADENCE_DEFER_MAX_BEATS, defer the commit to that bar so the change
  // lands on a phrase-end instead of mid-cadence. Round-end (lobby) and
  // build-end paths exited above and are never deferred. Hard switches
  // (capture / lastAlive / wolf-failing) bypass — they're event-driven.
  const pending = director.pendingBedSwitch;
  let pendingFiring = false;
  if (pending) {
    if (pending.targetBed === targetBed && renderer.currentBeat < pending.atBeat) {
      // Still waiting for the deferred commit; selection unchanged.
      return null;
    }
    // Either the wait is up (targetBed still matches) or selection changed.
    // Mark "firing" if the wait is up so we commit now without re-deferring.
    pendingFiring = pending.targetBed === targetBed;
    director.pendingBedSwitch = null;
  }

  // Same bed? Nothing to do.
  if (targetBed === director.currentBed && director.currentState === "active") {
    return null;
  }

  // Defer the bed switch to the outgoing bed's next authored phrase end:
  //   - Parametric flips: up to CADENCE_DEFER_MAX_BEATS (~4 beats / 1 bar).
  //     Reactivity dominates; we only catch a phrase-end if it's right
  //     there.
  //   - Endgame override (hardSwitch + endgame target): up to
  //     ENDGAME_CADENCE_MAX_BEATS (~16 beats / 4 bars). Endgame plays for
  //     ≥30s after entry, so a few beats of slack to land the source's
  //     cadence is essentially free musically — and prevents the source
  //     bed (e.g. desperate-frustrated) from getting cropped just before
  //     its authored climax.
  //   - Other hard switches (capture / lastAlive / wolf-failing): no defer.
  //     These are event-driven and the listener expects immediate response.
  //   - First active entry, pending-firing, no primary: skipped above.
  let cadenceMaxBeats = 0;
  if (!selection.hardSwitch) {
    cadenceMaxBeats = CADENCE_DEFER_MAX_BEATS;
  } else if (typeof targetBed === "string" && targetBed.startsWith("endgame-")) {
    cadenceMaxBeats = ENDGAME_CADENCE_MAX_BEATS;
  }
  if (
    !pendingFiring &&
    director.currentState === "active" &&
    cadenceMaxBeats > 0 &&
    renderer.primary
  ) {
    const atBeat = nextTransitionBeat(
      renderer.primary, renderer.currentBeat, cadenceMaxBeats,
    );
    if (atBeat !== null) {
      director.pendingBedSwitch = { targetBed, atBeat };
      return null;
    }
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
