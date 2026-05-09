/**
 * Facet smoothing — engine-side temporal smoothing of game-supplied facets.
 *
 * The game produces target facets per tick. The engine smooths target →
 * current via exponential filters so the music's reaction time is decoupled
 * from the game's update rate. Bed selection and modulation read the
 * smoothed `current` facets, never the raw target.
 *
 * No game-side aggregation lives here anymore — the game is responsible
 * for computing its own threat / proximity / isolation scalars from
 * gameplay-specific information (weapon range, terrain, hidden sheep,
 * mode-specific rules) the engine can't see.
 *
 * Round progress is no longer carried on facets. The harness reports
 * roundElapsedSeconds + roundDurationSeconds at the FullGameState level;
 * the engine derives progress and threads it through to isWolfFailing as
 * a separate argument.
 */

import { type SheepFacets, type WolfFacets } from "./types.ts";
import { TUNING } from "./tuning.ts";

/** Exponential smoothing toward target. */
function smooth(prev: number, target: number, tau: number, dt: number): number {
  if (tau <= 0) return target;
  const alpha = 1 - Math.exp(-dt / tau);
  return prev + (target - prev) * alpha;
}

/** Smooth target sheep facets toward `prev`. If `prev` is null, returns
 *  target unchanged (first tick — nothing to smooth from). */
export function smoothSheepFacets(
  target: SheepFacets,
  prev: SheepFacets | null,
  dt: number,
): SheepFacets {
  if (!prev) return target;
  return {
    alive: target.alive,
    threat: smooth(prev.threat, target.threat, TUNING.THREAT_TAU, dt),
    agency: smooth(prev.agency, target.agency, TUNING.SLOW_TAU, dt),
    isolation: smooth(prev.isolation, target.isolation, TUNING.SLOW_TAU, dt),
    lastAlive: target.lastAlive,
  };
}

/** Smooth target wolf facets toward `prev`. */
export function smoothWolfFacets(
  target: WolfFacets,
  prev: WolfFacets | null,
  dt: number,
): WolfFacets {
  if (!prev) return target;
  return {
    proximity: smooth(prev.proximity, target.proximity, TUNING.PROXIMITY_TAU, dt),
    agency: smooth(prev.agency, target.agency, TUNING.SLOW_TAU, dt),
    isolation: smooth(prev.isolation, target.isolation, TUNING.SLOW_TAU, dt),
  };
}

/** Derived: is the wolf side losing late in the round? Drives the
 *  desperate bed switch. Computed internally from agency + engine-derived
 *  round progress rather than asked of the game, since it's a renderer-
 *  policy decision. */
export function isWolfFailing(facets: WolfFacets, progress: number): boolean {
  return facets.agency < TUNING.WOLF_FAILING_AGENCY
    && progress > TUNING.WOLF_FAILING_PROGRESS;
}
