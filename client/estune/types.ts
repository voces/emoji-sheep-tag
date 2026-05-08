/**
 * V3 Stem-Based Adaptive Music Engine — Core Types
 *
 * Runtime types for segments, layers, and the game→music interface.
 * Authoring format compiles down to these types.
 */

// ── Note & Layer ──

export type Articulation = "legato" | "staccato" | "accent" | "tenuto";

export interface NoteEvent {
  /** Beat offset from segment start (0-indexed, fractional for sub-beats). */
  beat: number;
  /** MIDI note number. */
  midi: number;
  /** Duration in beats. */
  duration: number;
  /** Velocity 0-1. Omit for default (role-based). */
  velocity?: number;
  /** Articulation marking. Omit for normal. */
  articulation?: Articulation;
}

/** Layer roles. Map directly to the V1–V8 voice architecture in
 *  [musical-foundation.md §2]. `sparkle` is the V7 color voice — celesta
 *  on the sheep side (magic/spirit/victory), and the taunting celesta
 *  bleed on the wolf side. */
export type LayerRole = "melody" | "counter" | "bass" | "arp" | "pad" | "perc" | "drone" | "sparkle";

/** Source parameter for a bleed-modulated layer's gain.
 *  - "tension":          gain ≈ mood.tension. Used for sheep-side palette
 *                        bleed (timpani enters as wolf proximity rises).
 *  - "inverse-tension":  gain ≈ 1 - mood.tension. Used for wolf-side
 *                        palette bleed (sheep-coded color creeps in when
 *                        the wolf is losing). */
export type BleedSource = "tension" | "inverse-tension";

/** Optional palette-bleed modulator on a layer. The layer's authored part
 *  is the *full-intensity* version; the engine multiplies its scheduled
 *  velocity by `max(floor, sourceValue)` per tick. At zero effective gain
 *  the layer's notes are suppressed entirely (under the audibility floor).
 *
 *  Implements the catalogue's documented "war drums grow as the round
 *  progresses" mechanic ([musical-foundation.md §1, §3]) without requiring
 *  per-segment gain envelopes. */
export interface BleedSpec {
  source: BleedSource;
  /** Minimum effective gain regardless of source value (default 0). Used
   *  to give a bed a baseline presence — e.g. `hero` keeps a quiet timpani
   *  pulse even at low tension because the lone sheep is already facing
   *  the threat. */
  floor: number;
}

export interface Layer {
  id: string;
  role: LayerRole;
  /** General MIDI program number. */
  instrument: number;
  /** 0 = foundation (always on), 1 = core, 2 = color (shed first). */
  priority: number;
  notes: NoteEvent[];
  /** Optional palette-bleed modulator. See BleedSpec. */
  bleed?: BleedSpec;
}

// ── Segment ──

export interface Key {
  root: string;    // "C" | "C#" | "Db" | "D" | ... | "B"
  mode: string;    // "major" | "minor" | "dorian" | "mixolydian" | ...
}

export type SegmentTag =
  // mood
  | "pastoral" | "tense" | "dark" | "urgent" | "wonder"
  // perspective
  | "sheep" | "wolf" | "spirit"
  // form
  | "intro" | "verse" | "chorus" | "bridge" | "outro"
  // energy
  | "climax" | "calm" | "building" | "dissolving"
  // structural
  | "transition" | "stinger";

export interface TransitionHint {
  /** Bar number where exit is clean (0-indexed). */
  bar: number;
  type: "phrase-end" | "half-cadence" | "full-cadence" | "any";
  /** Keys we can transition TO from this point. */
  compatibleKeys: Key[];
}

/**
 * Breathing pattern: periodic silencing of opt-in layers during long bed
 * holds. Creates ebb-and-flow ("the music takes a breath then resumes")
 * without permanently thinning intensity. Used to keep the listener
 * engaged when a bed is held for many loops (e.g. cautious held while the
 * sheep stays in mid-threat for a minute+).
 *
 * Cycle: dwell `after` bars at full → mute `layers` for `hold` bars →
 * restore until the next cycle starts (every `every` bars from `after`).
 *
 * Example: `{ after: 16, every: 12, hold: 4, layers: ["arp", "perc"] }`
 *   - bars 0-16: full bed (the first loop plays in full)
 *   - bars 16-20: arp + perc muted (4-bar in-breath)
 *   - bars 20-28: full
 *   - bars 28-32: muted again
 *   - ...continues until bed exits
 */
export interface BreathSpec {
  /** Bars of bed-dwell before breathing engages. */
  after: number;
  /** Bars per breath cycle. */
  every: number;
  /** Bars of "in-breath" (silence) within each cycle. */
  hold: number;
  /** Layer ids that silence during the in-breath. Other layers are unaffected. */
  layers: string[];
}

export interface Segment {
  id: string;
  key: Key;
  /** Base BPM (can be scaled at runtime). */
  tempo: number;
  meter: [number, number];
  /** Segment length in bars. */
  bars: number;
  /** Total beats (bars * beatsPerBar), computed on compile. */
  totalBeats: number;
  layers: Layer[];
  tags: SegmentTag[];
  transitions: TransitionHint[];
  /** Which family this segment belongs to. */
  family: string;
  /** Optional periodic-thinning pattern for long bed holds. See BreathSpec. */
  breath?: BreathSpec;
  /** Song-set tag for round-coherent variant selection. Variants of a bed
   *  declare which "song" (palette / motif system) they belong to; per round
   *  the director picks one song and uses matching variants for ALL beds so
   *  the round feels musically unified. Defaults to "base" — segments
   *  without an explicit song are the canonical fallback. See bedDirector
   *  pickVariant + pickSongForRound. */
  song: string;
}

// ── Game → Music Interface ──

export type Perspective = "sheep" | "wolf" | "spirit";

/**
 * Game phase — maps directly to segment families.
 * The game knows which phase it's in; the music director
 * doesn't need to infer it from continuous params.
 */
export type GamePhase =
  | "intermission-pre"     // before first round
  | "intermission-between" // between rounds
  | "sheep-prep"           // 0-18s, sheep building, no wolves
  | "wolf-wait"            // 0-18s, wolves blind
  | "early"                // wolves just spawned
  | "early-mid"            // tug of war phase
  | "mid"                  // sustained, economy, items
  | "late-dominant"        // sheep ahead, confident
  | "late-desperate"       // wolves behind, time pressure
  | "last-stand"           // one sheep left alive
  | "victory-build"        // final 15-20s, sheep about to win
  | "victory"              // sheep win — climax
  | "round-end-wolves"     // wolves win
  | "spirit"               // captured — ethereal, filtered
  | "rescue"               // just rescued — bright, hopeful
  | "hiding"               // sheep hiding — whimsical, playful
  | "seeking"              // wolf searching — prowling, light menace
  | "defeat-build"         // wolves losing — dread countdown
  ;

/**
 * Continuous parameters — drive vertical mixing (layer gains, velocity)
 * and bleed modulation. Updated frequently (every ~100ms).
 *
 * Note: V1 had `darkness` and `wonder` fields here; both were declared
 * but never consumed by V2's modulation pipeline. Removed to keep the
 * surface honest about what the engine actually reads.
 */
export interface MoodParams {
  tension: number;     // 0 = peaceful, 1 = conflict (drives bleed)
  energy: number;      // velocity scaling + color-layer shedding
  urgency: number;     // tempo modulation
}

/**
 * Discrete game events — trigger stingers. Fired once per occurrence.
 *
 * Structural transitions (lobby/build/active) are NOT events — the engine
 * detects them from the per-tick `state` field in FullGameState and fires
 * bed-bridge stingers automatically. Use this channel only for narrative
 * beats the state field doesn't already convey.
 */
export type GameEvent =
  // Capture / rescue / assassination-attempt: `subject` indicates whether
  // the local player was the sheep involved, vs an ally. Self events are
  // visceral (you transitioned to spirit / dodged death); ally events are
  // peripheral (a teammate did). The engine doesn't compose distinct
  // stingers per subject yet, but the API exposes the distinction so the
  // game doesn't need to migrate later when we do.
  | { type: "capture"; subject: "self" | "ally" }                    // a sheep was tagged
  | { type: "rescue"; subject: "self" | "ally" }                     // a spirit was revived
  | { type: "assassination-attempt"; subject: "self" | "ally" }      // wolf used a kill item; sheep dodged
  | { type: "round-end"; winner: "sheep" | "wolf" }                  // outcome carries the winner
  ;

/**
 * Full game state snapshot — sent to music director each tick.
 */
export interface GameMusicState {
  phase: GamePhase;
  perspective: Perspective;
  mood: MoodParams;
  /** Seconds remaining in round (null if no timer). */
  roundTimer: number | null;
  /** Seconds until a known event (e.g. wolf spawn at 18s). null if unknown. */
  nextEventIn: number | null;
  /** What the next known event is. */
  nextEventType: GameEvent["type"] | null;
  /** Base obstructions placed per minute (drives energy, not individual events). */
  obstructionRate: number;
}

// ── Reactive Overlays ──

export interface ReactiveOverlay {
  /** Game event that triggers this overlay. */
  trigger: GameEvent["type"];
  notes: NoteEvent[];
  instrument: number;
  /** Gain relative to current mix (0-1). */
  gain: number;
  /** Beats to fade out after notes end. */
  fadeBeats: number;
}

// ── Phase 2 architecture: structural state + situational facets ──

/** Top-level game flow. Three discrete states the engine follows; it doesn't choose between them. */
export type StructuralState = "lobby" | "build" | "active";

/** Situational facets within Active play, sheep perspective. All run in parallel. */
export interface SheepFacets {
  alive: boolean;
  /** 0-1, smoothed. Combined wolf-proximity / facing / recent damage / ally support. */
  threat: number;
  /** -1 to +1, smoothed. Team dominance: -1 losing, +1 winning. */
  agency: number;
  /** 0-1, smoothed. Distance to ally + time since team contact. */
  isolation: number;
  /** Only living sheep on field. */
  lastAlive: boolean;
  /** 0-1, normalized time elapsed in round. */
  roundProgress: number;
}

/** Situational facets within Active play, wolf perspective.
 *
 *  `failing` is derived internally from agency + roundProgress (see
 *  `isWolfFailing` in beds.ts) — the game doesn't compute it.
 *
 *  `isolation` is consumed by modulation for texture density (lone-wolf
 *  thinning). Optional: pass 0 if the game doesn't track pack scatter. */
export interface WolfFacets {
  /** 0-1, smoothed. Hunting intensity — game-computed from whatever sheep
   *  proximity / line-of-sight model fits gameplay. */
  proximity: number;
  /** -1 to +1, smoothed. Pack dominance. */
  agency: number;
  /** 0-1, smoothed. Pack scatter / lone-wolf feel. Pass 0 if not tracked. */
  isolation: number;
  /** 0-1, normalized time elapsed in round. */
  roundProgress: number;
}

/** Active-play beds, selected by facets. */
export type SheepBed = "building" | "cautious" | "terror" | "hero" | "spirit";
export type WolfBed =
  | "patrolling" | "stalking" | "attack"
  // Wolf-failing splits by proximity:
  //   desperate            — predator-failing, far from sheep, slow horn
  //                          descent, sheep-bells taunt (resigned)
  //   desperate-frustrated — predator-failing but actively chasing
  //                          (proximity high), repetitive stabs, drives
  //                          the V7 perc, no resignation
  | "desperate" | "desperate-frustrated";

/** Structural beds, selected by `state` + `mode`. Lobby is shared between
 *  perspectives; build is mode-keyed and perspective-keyed. Practice mode
 *  has no entry — it stays on the lobby bed. */
export type StructuralBedId =
  | "lobby"
  | "build-sheep-bulldog"  | "build-wolf-bulldog"
  | "build-sheep-switch"   | "build-wolf-switch"
  | "build-sheep-survival" | "build-wolf-survival";

/** All bed ids the runtime knows about. The bed library is keyed by this
 *  union; consumers building a library should pass `BedSource.bed` as one
 *  of these literal values, no cast needed. */
export type BedId = SheepBed | WolfBed | StructuralBedId;

/** Per-round leitmotif. Selected at round start, baked into all beds for that round. */
export interface Hook {
  id: string;
  /** Notes in C-major-relative scale degrees so transposition into Gm/Em is mechanical. */
  notes: NoteEvent[];
  character: "lyrical" | "dotted" | "leaping" | "wide-range";
}

/** Predictable upcoming events the game can foresee with varying confidence.
 *  Music uses these to *stage* high-confidence events ahead of time (pre-swells,
 *  bed modulation toward predicted state) while only flagging low-confidence
 *  ones (threat lift without committing to a stinger). */
export type AnticipationEvent =
  | "capture"
  | "rescue"
  | "sacrificial-rescue";

/** Game mode: drives build-phase length, bridge intensity, and any future
 *  mode-specific musical choices. Mirrors emoji-sheep-tag's mode setting
 *  (server/lobby.ts:LobbyMode).
 *
 *  - survival: standard team mode (sheep team vs wolf team).
 *  - vip:      one designated VIP sheep; round ends if VIP dies regardless
 *              of other sheep state.
 *  - switch:   short head start (2s); on capture/being-captured the
 *              individual player swaps role.
 *  - vamp:     captured sheep convert to wolves (no spirit phase). Round
 *              ends when all sheep are converted.
 *  - bulldog:  90s flat timer counting AGAINST the sheep. Wolves spawn
 *              alongside sheep (no head start).
 */
export type GameMode = "survival" | "vip" | "switch" | "vamp" | "bulldog";

export interface Anticipation {
  event: AnticipationEvent;
  /** Seconds until predicted event lands. */
  lead: number;
  /** 0–1: how sure are we this will happen. */
  confidence: number;
}

/** Full per-tick game state, replaces phase-only routing. */
export interface FullGameState {
  state: StructuralState;
  perspective: Perspective;
  /** Present when perspective === "sheep" or "spirit". */
  sheep?: SheepFacets;
  /** Present when perspective === "wolf". */
  wolf?: WolfFacets;
  /** Hook chosen for this round. Null in Lobby. */
  roundHook: Hook | null;
  /** Upcoming events the game predicts; music stages high-confidence ones early. */
  anticipation?: Anticipation[];
  /** Game mode. Defaults to "survival" if omitted. Drives bridge intensity and
   *  build-phase length in scenario generation. */
  mode?: GameMode;
}

// (Raw inputs removed — the game now produces SheepFacets / WolfFacets
// directly. Engine-side temporal smoothing of those facets happens in
// facets.ts. Per-game distance/aggregation models stay game-side where
// they have access to gameplay-specific information the engine can't
// see — weapon range, terrain, hidden sheep, mode-specific rules.)
