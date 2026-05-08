/**
 * Bed selection: facets → bed identity (with optional crossfade blend).
 *
 * Selection is a priority list, not a parameter map.
 * Discrete switches (alive→spirit, last-alive→hero, failing→desperate) override
 * the threat/proximity crossfade between sibling beds.
 */

import {
  type SheepFacets, type WolfFacets,
  type SheepBed, type WolfBed, type BedId,
} from "./types.ts";
import { isWolfFailing } from "./facets.ts";

/** Crossfade thresholds for sheep building/cautious/terror. */
const SHEEP_T1 = 0.3; // building → cautious
const SHEEP_T2 = 0.65; // cautious → terror

/** Crossfade thresholds for wolf patrolling/stalking/attack. */
const WOLF_P1 = 0.3; // patrolling → stalking
const WOLF_P2 = 0.65; // stalking → attack

/** Crossfade threshold for the desperate split. When isWolfFailing is true:
 *  - proximity below this = "desperate" (resigned, sheep far away)
 *  - proximity above this = "desperate-frustrated" (still chasing, can't kill)
 *  Authored higher than WOLF_P1 (0.3) because the wolf can be far from any
 *  individual sheep but still actively hunting; resigned only kicks in when
 *  the wolf has lost contact entirely. */
const WOLF_DESPERATE_PROXIMITY = 0.5;

/**
 * Width of the blend zone around each threshold. Within this band the
 * `secondary` bed has nonzero `blend` weight for crossfade rendering.
 */
const BLEND_WIDTH = 0.08;

export interface BedSelection {
  primary: BedId;
  /** When in a crossfade zone, the neighboring bed. Otherwise null. */
  secondary: BedId | null;
  /** 0 = pure primary; 1 = fully into secondary. */
  blend: number;
  /**
   * True when this selection came from a discrete priority override
   * (alive=false, lastAlive=true, failing=true). The engine uses this
   * to pick a hard crossfade duration rather than a parametric blend.
   */
  hardSwitch: boolean;
}

/** Sheep priority: alive → spirit, lastAlive → hero, else threat-crossfade. */
export function selectSheepBed(facets: SheepFacets): SheepBed {
  if (!facets.alive) return "spirit";
  if (facets.lastAlive) return "hero";
  if (facets.threat < SHEEP_T1) return "building";
  if (facets.threat < SHEEP_T2) return "cautious";
  return "terror";
}

/** Sheep selection with crossfade blend information. */
export function selectSheepBedWithBlend(facets: SheepFacets): BedSelection {
  if (!facets.alive) {
    return { primary: "spirit", secondary: null, blend: 0, hardSwitch: true };
  }
  if (facets.lastAlive) {
    return { primary: "hero", secondary: null, blend: 0, hardSwitch: true };
  }
  return blendThree("building", "cautious", "terror", facets.threat, SHEEP_T1, SHEEP_T2);
}

/** Wolf priority: failing → desperate (split by proximity into resigned vs
 *  frustrated), else proximity-crossfade across patrolling/stalking/attack. */
export function selectWolfBed(facets: WolfFacets): WolfBed {
  if (isWolfFailing(facets)) {
    return facets.proximity < WOLF_DESPERATE_PROXIMITY
      ? "desperate"
      : "desperate-frustrated";
  }
  if (facets.proximity < WOLF_P1) return "patrolling";
  if (facets.proximity < WOLF_P2) return "stalking";
  return "attack";
}

export function selectWolfBedWithBlend(facets: WolfFacets): BedSelection {
  if (isWolfFailing(facets)) {
    // Crossfade between desperate (low prox) and desperate-frustrated
    // (high prox) within a ±BLEND_WIDTH band around WOLF_DESPERATE_PROXIMITY.
    // hardSwitch stays true so the entry into the failing branch (from
    // attack/stalking) gets a beat-snap, not phrase-snap — same as before.
    // But within-failing flips between resigned and frustrated are *not*
    // hardSwitch (smoother transition since the player's still in the same
    // emotional space, just shifted by proximity).
    const p = facets.proximity;
    const t = WOLF_DESPERATE_PROXIMITY;
    if (p <= t - BLEND_WIDTH) {
      return { primary: "desperate", secondary: null, blend: 0, hardSwitch: true };
    }
    if (p < t + BLEND_WIDTH) {
      const blend = (p - (t - BLEND_WIDTH)) / (2 * BLEND_WIDTH);
      return blend < 0.5
        ? { primary: "desperate", secondary: "desperate-frustrated", blend: blend * 2, hardSwitch: false }
        : { primary: "desperate-frustrated", secondary: "desperate", blend: (1 - blend) * 2, hardSwitch: false };
    }
    return { primary: "desperate-frustrated", secondary: null, blend: 0, hardSwitch: true };
  }
  return blendThree("patrolling", "stalking", "attack", facets.proximity, WOLF_P1, WOLF_P2);
}

/**
 * Three-bed parametric blend. Returns the dominant bed plus a neighbor with
 * blend weight 0..1 within a ±BLEND_WIDTH band around each threshold.
 *
 * Layout along the parameter:
 *   |----low----| transition |----mid----| transition |----high----|
 *      (low)      (low+mid)      (mid)      (mid+high)     (high)
 */
function blendThree<T extends BedId>(
  low: T, mid: T, high: T,
  param: number, t1: number, t2: number,
): BedSelection {
  // Below low band (deep in low region)
  if (param <= t1 - BLEND_WIDTH) {
    return { primary: low, secondary: null, blend: 0, hardSwitch: false };
  }
  // Crossfade low ↔ mid
  if (param < t1 + BLEND_WIDTH) {
    const blend = (param - (t1 - BLEND_WIDTH)) / (2 * BLEND_WIDTH);
    return blend < 0.5
      ? { primary: low, secondary: mid, blend: blend * 2, hardSwitch: false }
      : { primary: mid, secondary: low, blend: (1 - blend) * 2, hardSwitch: false };
  }
  // Deep in mid region
  if (param <= t2 - BLEND_WIDTH) {
    return { primary: mid, secondary: null, blend: 0, hardSwitch: false };
  }
  // Crossfade mid ↔ high
  if (param < t2 + BLEND_WIDTH) {
    const blend = (param - (t2 - BLEND_WIDTH)) / (2 * BLEND_WIDTH);
    return blend < 0.5
      ? { primary: mid, secondary: high, blend: blend * 2, hardSwitch: false }
      : { primary: high, secondary: mid, blend: (1 - blend) * 2, hardSwitch: false };
  }
  // Deep in high region
  return { primary: high, secondary: null, blend: 0, hardSwitch: false };
}
