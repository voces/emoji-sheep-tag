/**
 * Tunable constants for facet computation. Centralized here so the playtester
 * can adjust feel without recompiling code paths.
 */

export const TUNING = {
  /** Distance at which threat starts being non-zero. */
  DANGER_RADIUS: 30,
  /** Distance at which an ally provides full support relief. */
  SUPPORT_RADIUS: 20,
  /** Damage recency decay constant (seconds). */
  DAMAGE_RECENCY_TAU: 3,

  /** Threat smoothing time constant (seconds). */
  THREAT_TAU: 0.5,
  /** Proximity smoothing time constant (seconds). */
  PROXIMITY_TAU: 0.5,
  /** Agency / isolation smoothing time constant (seconds). */
  SLOW_TAU: 2.0,
  /** Pack momentum smoothing time constant (seconds). */
  PACK_TAU: 5.0,

  /** Facet-isolation: ally-distance scale. */
  ALLY_ISOLATION_RADIUS: 40,
  /** Wolf-isolation: packmate-distance scale. */
  PACK_ISOLATION_RADIUS: 35,

  /** Wolf failing threshold: agency lower bound. */
  WOLF_FAILING_AGENCY: -0.5,
  /** Wolf failing threshold: round-progress lower bound. */
  WOLF_FAILING_PROGRESS: 0.6,

  /** Threat formula weights (must roughly sum to 1). */
  THREAT_W_DISTANCE: 0.5,
  THREAT_W_FACING: 0.2,
  THREAT_W_RECENCY: 0.2,
  THREAT_W_ALLY: 0.1,

  /** Proximity formula weights. */
  PROX_W_DISTANCE: 0.55,
  PROX_W_LOS: 0.2,
  PROX_W_KILL: 0.25,
} as const;
