/**
 * Music Director: maps game state to segment selection and sequencing.
 *
 * Responsibilities:
 * - GamePhase → segment family routing
 * - Shuffle within family (no immediate repeats)
 * - Auto-advance to next segment at loop boundary
 * - Family switch on phase change (immediate or at next bar boundary)
 */

import { type Segment, type GamePhase, type Perspective } from "./types.ts";
import {
  type RendererState, playSegment, stopAll,
} from "./renderer.ts";

// ── Phase × Perspective → Family mapping ──
// Some phases sound different depending on who's playing.

const PHASE_FAMILY: Record<GamePhase, string> = {
  "intermission-pre": "intermission",
  "intermission-between": "intermission",
  "sheep-prep": "sheep-prep",
  "wolf-wait": "wolf-wait",
  "early": "alert",        // default (sheep)
  "early-mid": "mid-game",
  "mid": "mid-game",
  "late-dominant": "sheep-dominant",
  "late-desperate": "wolf-desperate",
  "last-stand": "last-stand",
  "victory-build": "victory-build",
  "victory": "victory-climax",
  "round-end-wolves": "defeat",  // sheep perspective: wolves won = defeat for sheep
  "spirit": "spirit",
  "rescue": "rescue",
  "hiding": "hiding",
  "seeking": "seeking",
  "defeat-build": "defeat",
};

/** Wolf perspective overrides for shared phases. */
const WOLF_OVERRIDES: Partial<Record<GamePhase, string>> = {
  "early": "hunt",
  "early-mid": "hunt",
  "hiding": "seeking",
  "victory-build": "defeat",
  "victory": "defeat",
  "round-end-wolves": "victory",  // wolf perspective: wolves won = victory for wolf
  "mid": "hunt",
};

// ── Director state ──

export interface DirectorState {
  /** All available segments indexed by family. */
  families: Map<string, Segment[]>;
  /** Current perspective — affects which family some phases map to. */
  perspective: Perspective;
  /** Current active family name. */
  currentFamily: string;
  /** Index into the shuffled order for the current family. */
  playlistIndex: number;
  /** Shuffled order of segment indices for the current family. */
  playlist: number[];
  /** ID of the segment currently playing (to detect loop completion). */
  currentSegmentId: string;
  /** Last game phase we responded to. */
  lastPhase: GamePhase | null;
  /** Recently played segment IDs across all families (for variety). */
  recentSegments: string[];
  /** Max recent history to track. */
  maxRecent: number;
}

/** Build a director from the full segment library. */
export function createDirector(segments: Segment[]): DirectorState {
  const families = new Map<string, Segment[]>();
  for (const seg of segments) {
    const list = families.get(seg.family) ?? [];
    list.push(seg);
    families.set(seg.family, list);
  }

  return {
    families,
    perspective: "sheep",
    currentFamily: "",
    playlistIndex: 0,
    playlist: [],
    currentSegmentId: "",
    lastPhase: null,
    recentSegments: [],
    maxRecent: 20,
  };
}

/** Shuffle array in place (Fisher-Yates). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Build a shuffled playlist for a family, avoiding starting with the last-played segment. */
function buildPlaylist(familySegments: Segment[], lastSegId: string): number[] {
  const indices = familySegments.map((_, i) => i);
  shuffle(indices);

  // If first segment in shuffled order is the same as last played, swap it back
  if (familySegments.length > 1 && familySegments[indices[0]].id === lastSegId) {
    const swapIdx = 1 + Math.floor(Math.random() * (indices.length - 1));
    [indices[0], indices[swapIdx]] = [indices[swapIdx], indices[0]];
  }

  return indices;
}

/**
 * Get the next segment to play from the current family.
 * Advances the playlist, reshuffling when exhausted.
 */
function nextInFamily(director: DirectorState): Segment | null {
  const family = director.families.get(director.currentFamily);
  if (!family || family.length === 0) return null;

  // Advance playlist
  director.playlistIndex++;
  if (director.playlistIndex >= director.playlist.length) {
    // Reshuffle, avoiding repeat of last segment
    director.playlist = buildPlaylist(family, director.currentSegmentId);
    director.playlistIndex = 0;
  }

  const seg = family[director.playlist[director.playlistIndex]];
  if (!seg) return null;
  director.currentSegmentId = seg.id;

  // Track in recency
  director.recentSegments.push(seg.id);
  if (director.recentSegments.length > director.maxRecent) {
    director.recentSegments.shift();
  }

  return seg;
}

/**
 * Switch to a new family. Picks the first segment from a fresh shuffle.
 */
function switchFamily(director: DirectorState, family: string): Segment | null {
  const segments = director.families.get(family);
  if (!segments || segments.length === 0) return null;

  director.currentFamily = family;
  director.playlist = buildPlaylist(segments, director.currentSegmentId);
  director.playlistIndex = 0;

  const seg = segments[director.playlist[0]];
  director.currentSegmentId = seg.id;

  director.recentSegments.push(seg.id);
  if (director.recentSegments.length > director.maxRecent) {
    director.recentSegments.shift();
  }

  return seg;
}

/**
 * Called each time a segment finishes (loop boundary).
 * Decides whether to continue in the current family or switch.
 * Returns the next segment to play.
 */
export function onSegmentEnd(
  director: DirectorState,
  renderer: RendererState,
  currentPhase: GamePhase,
): Segment | null {
  const targetFamily = getPhaseFamily(currentPhase, director.perspective);

  // Phase changed → switch family
  if (targetFamily !== director.currentFamily) {
    return switchFamily(director, targetFamily);
  }

  // Same family → next in playlist
  return nextInFamily(director);
}

/**
 * Called when the game phase changes. May trigger an immediate family switch
 * or wait for the current segment to finish, depending on urgency.
 *
 * Returns a segment if an immediate switch is needed, null if we can wait.
 */
export function onPhaseChange(
  director: DirectorState,
  renderer: RendererState,
  newPhase: GamePhase,
): Segment | null {
  if (newPhase === director.lastPhase) return null;
  director.lastPhase = newPhase;

  const targetFamily = getPhaseFamily(newPhase, director.perspective);
  if (targetFamily === director.currentFamily) return null;

  // Determine if this is an urgent switch (needs immediate response)
  const urgent = isUrgentTransition(newPhase);

  if (urgent) {
    // Switch immediately
    return switchFamily(director, targetFamily);
  }

  // Non-urgent: let the current segment finish, then switch.
  // The family change is noted so onSegmentEnd picks it up.
  return null;
}

/** Some phase changes demand immediate musical response. */
function isUrgentTransition(phase: GamePhase): boolean {
  switch (phase) {
    case "sheep-prep":
    case "wolf-wait":
      return true;  // round start — clean break
    case "early":
      return true;  // wolves spawned — shadow falls NOW
    case "last-stand":
      return true;  // dramatic shift
    case "victory-build":
      return true;  // climax starts building
    case "victory":
      return true;  // sheep win!
    case "round-end-wolves":
      return true;  // round over
    case "intermission-pre":
    case "intermission-between":
      return true;  // clean break at round boundary
    case "spirit":
      return true;  // capture — immediate
    case "rescue":
      return true;  // rescue — immediate
    case "hiding":
    case "seeking":
      return false; // gradual — wait for segment end
    case "defeat-build":
      return true;  // dread countdown starts now
    default:
      return false; // gradual transitions can wait
  }
}

/** Get the family name for a phase, considering perspective. */
export function getPhaseFamily(phase: GamePhase, perspective: Perspective = "sheep"): string {
  if (perspective === "wolf") {
    const override = WOLF_OVERRIDES[phase];
    if (override) return override;
  }
  return PHASE_FAMILY[phase] ?? "intermission";
}

/** Switch to a family (exported for pre-fade use). */
export function switchFamilyForPrefade(director: DirectorState, family: string): Segment | null {
  return switchFamily(director, family);
}

/**
 * Initialize the director: start playing the first segment for the given phase.
 */
export function startDirector(
  director: DirectorState,
  renderer: RendererState,
  initialPhase: GamePhase,
): void {
  director.lastPhase = initialPhase;
  const family = getPhaseFamily(initialPhase, director.perspective);
  const seg = switchFamily(director, family);
  if (seg) {
    playSegment(renderer, seg);
  }
}
