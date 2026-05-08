/**
 * Agency computation for adaptive music facets.
 *
 * Pure module: takes an event log + current snapshot, returns a clamped
 * agency value in [-1, 1]. The wiring layer (v3.ts) is responsible for
 * recording events and sampling proximity each tick.
 *
 * Composition (each contribution adds, then we clamp):
 *   - Living-count base       : sheep alive vs total (slowest signal)
 *   - Round progress          : tiny sheep boost late, larger wolf decay
 *   - Kill / rescue spikes    : exp-decay τ≈35s (≈7.6% at 90s, ≈3% at 120s)
 *   - Structures vs expected  : tanh(log2(actual/expected)); per-unit + team
 *   - Proximity history (60s) : peak-weighted (power mean p=3) — short close
 *                                calls dominate the calm minutes around them
 */
export type KillEvent = {
  victimId: string;
  /** Owner ID of the killing wolf. Omitted when the killer can't be
   *  resolved (e.g. wolf died before client could look it up); the wolf
   *  agency contribution falls back to a uniform spike. */
  killerId?: string;
  time: number;
};
export type RescueEvent = { rescuedId: string; time: number };
export type ProximitySample = { time: number; value: number };

export type AgencyEvents = {
  kills: KillEvent[];
  rescues: RescueEvent[];
  proximityHistory: Map<string, ProximitySample[]>;
};

export const createAgencyEvents = (): AgencyEvents => ({
  kills: [],
  rescues: [],
  proximityHistory: new Map(),
});

export const resetAgencyEvents = (e: AgencyEvents): void => {
  e.kills.length = 0;
  e.rescues.length = 0;
  e.proximityHistory.clear();
};

export const recordKill = (
  e: AgencyEvents,
  victimId: string,
  time: number,
  killerId?: string,
): void => {
  e.kills.push({ victimId, killerId, time });
};

export const recordRescue = (
  e: AgencyEvents,
  rescuedId: string,
  time: number,
): void => {
  e.rescues.push({ rescuedId, time });
};

export const recordProximity = (
  e: AgencyEvents,
  unitId: string,
  value: number,
  time: number,
): void => {
  let arr = e.proximityHistory.get(unitId);
  if (!arr) {
    arr = [];
    e.proximityHistory.set(unitId, arr);
  }
  arr.push({ time, value });
};

const KILL_DECAY_TAU_S = 35;
const RESCUE_DECAY_TAU_S = 35;
const EVENT_FRESH_S = 120;
const PROXIMITY_HISTORY_S = 60;

const KILL_SHEEP_KILLED_OWN = 0.50;
const KILL_SHEEP_KILLED_ALLY = 0.18;
const KILL_WOLF_KILLER = 0.50;
const KILL_WOLF_ASSIST = 0.25;
const KILL_WOLF_UNIFORM = 0.35;

const RESCUE_SHEEP_OWN = 0.35;
const RESCUE_SHEEP_ALLY = 0.25;
const RESCUE_WOLF_UNIFORM = 0.30;

const BASE_LIVING_WEIGHT = 0.50;
const LIVING_CONVEXITY = 6;
const ROUND_PROGRESS_SHEEP_WEIGHT = 0.10;
const ROUND_PROGRESS_WOLF_WEIGHT = 0.20;
const STRUCTURE_PER_UNIT_WEIGHT = 0.15;
const STRUCTURE_TEAM_WEIGHT = 0.15;
const PROXIMITY_WEIGHT = 0.20;

const STRUCT_FIRST_MINUTE = 80;
const STRUCT_PER_MINUTE_DECAY = 0.7;

const clamp11 = (x: number): number => Math.max(-1, Math.min(1, x));

/** Convex-on-dead-fraction living contribution in [-1, +1]. The first death
 *  is nearly free in a large team (5v5 1 dead → +0.76), but the curve
 *  accelerates: 5v5 2 dead → +0.04, 5v5 3+ dead → -1. Smaller teams hit the
 *  knee faster (2v2 1 dead → -0.5, 1v1 1 dead → clamped -1). */
const livingContribution = (
  livingSheep: number,
  totalSheep: number,
): number => {
  if (totalSheep <= 0) return 0;
  const deadFraction = (totalSheep - Math.max(0, livingSheep)) / totalSheep;
  return clamp11(1 - LIVING_CONVEXITY * deadFraction * deadFraction);
};

/** Cumulative expected structures for a single sheep at `elapsedSeconds`.
 *  Geometric series: each minute's expectation is 70% of the previous.
 *  60s→80, 120s→136, 180s→175, ∞→266.67. */
export const expectedStructuresPerSheep = (elapsedSeconds: number): number => {
  if (elapsedSeconds <= 0) return 0;
  const minutes = elapsedSeconds / 60;
  const r = STRUCT_PER_MINUTE_DECAY;
  return STRUCT_FIRST_MINUTE * (1 - Math.pow(r, minutes)) / (1 - r);
};

/** Symmetric structure-ratio contribution: 1× → 0, 2× → ~+0.79, 0.5× → ~-0.79.
 *  When `expected ≤ 0` we have no opinion (early build phase). */
const structureRatioContribution = (
  actual: number,
  expected: number,
): number => {
  if (expected <= 0) return 0;
  const ratio = actual / expected;
  return Math.tanh(Math.log(Math.max(0.01, ratio)) / Math.LN2);
};

/** Power-mean p=3 of recent proximity samples — max-biased so a single
 *  close call leaves a footprint on the 60s window even if the sheep
 *  spent most of it safe. Returns 0.5 when no samples (neutral). */
const peakProximity = (
  arr: ProximitySample[] | undefined,
  now: number,
): number => {
  if (!arr || arr.length === 0) return 0.5;
  const cutoff = now - PROXIMITY_HISTORY_S * 1000;
  let sum = 0;
  let count = 0;
  for (const s of arr) {
    if (s.time < cutoff) continue;
    sum += s.value * s.value * s.value;
    count += 1;
  }
  if (count === 0) return 0.5;
  return Math.cbrt(sum / count);
};

/** Drop events older than `EVENT_FRESH_S`; cheap O(n) sweep. */
export const pruneAgencyEvents = (e: AgencyEvents, now: number): void => {
  const cutoff = now - EVENT_FRESH_S * 1000;
  e.kills = e.kills.filter((k) => k.time >= cutoff);
  e.rescues = e.rescues.filter((r) => r.time >= cutoff);
  const proxCutoff = now - PROXIMITY_HISTORY_S * 1000;
  for (const [id, arr] of e.proximityHistory) {
    const kept = arr.filter((s) => s.time >= proxCutoff);
    if (kept.length === 0) e.proximityHistory.delete(id);
    else e.proximityHistory.set(id, kept);
  }
};

export type SheepAgencyParams = {
  unitId: string;
  livingSheep: number;
  totalSheep: number;
  roundProgress: number;
  elapsedSeconds: number;
  unitStructures: number;
  teamStructures: number;
  now: number;
};

export const computeSheepAgencyValue = (
  events: AgencyEvents,
  p: SheepAgencyParams,
): number => {
  let a = 0;

  a += BASE_LIVING_WEIGHT * livingContribution(p.livingSheep, p.totalSheep);

  a += ROUND_PROGRESS_SHEEP_WEIGHT * p.roundProgress;

  for (const k of events.kills) {
    const dt = (p.now - k.time) / 1000;
    if (dt < 0 || dt > EVENT_FRESH_S) continue;
    const decay = Math.exp(-dt / KILL_DECAY_TAU_S);
    const isSelf = k.victimId === p.unitId;
    a -= (isSelf ? KILL_SHEEP_KILLED_OWN : KILL_SHEEP_KILLED_ALLY) * decay;
  }

  for (const r of events.rescues) {
    const dt = (p.now - r.time) / 1000;
    if (dt < 0 || dt > EVENT_FRESH_S) continue;
    const decay = Math.exp(-dt / RESCUE_DECAY_TAU_S);
    const isSelf = r.rescuedId === p.unitId;
    a += (isSelf ? RESCUE_SHEEP_OWN : RESCUE_SHEEP_ALLY) * decay;
  }

  const unitExpected = expectedStructuresPerSheep(p.elapsedSeconds);
  a += STRUCTURE_PER_UNIT_WEIGHT *
    structureRatioContribution(p.unitStructures, unitExpected);

  const teamExpected = unitExpected * Math.max(0, p.livingSheep);
  a += STRUCTURE_TEAM_WEIGHT *
    structureRatioContribution(p.teamStructures, teamExpected);

  const peak = peakProximity(events.proximityHistory.get(p.unitId), p.now);
  a += PROXIMITY_WEIGHT * (1 - 2 * peak);

  return clamp11(a);
};

export type WolfAgencyParams = {
  unitId: string;
  livingSheep: number;
  totalSheep: number;
  roundProgress: number;
  elapsedSeconds: number;
  teamStructures: number;
  now: number;
};

export const computeWolfAgencyValue = (
  events: AgencyEvents,
  p: WolfAgencyParams,
): number => {
  let a = 0;

  a -= BASE_LIVING_WEIGHT * livingContribution(p.livingSheep, p.totalSheep);

  a -= ROUND_PROGRESS_WOLF_WEIGHT * p.roundProgress;

  for (const k of events.kills) {
    const dt = (p.now - k.time) / 1000;
    if (dt < 0 || dt > EVENT_FRESH_S) continue;
    const decay = Math.exp(-dt / KILL_DECAY_TAU_S);
    const value = k.killerId === undefined
      ? KILL_WOLF_UNIFORM
      : k.killerId === p.unitId
      ? KILL_WOLF_KILLER
      : KILL_WOLF_ASSIST;
    a += value * decay;
  }

  for (const r of events.rescues) {
    const dt = (p.now - r.time) / 1000;
    if (dt < 0 || dt > EVENT_FRESH_S) continue;
    const decay = Math.exp(-dt / RESCUE_DECAY_TAU_S);
    a -= RESCUE_WOLF_UNIFORM * decay;
  }

  const teamExpected = expectedStructuresPerSheep(p.elapsedSeconds) *
    Math.max(0, p.livingSheep);
  a -= STRUCTURE_TEAM_WEIGHT *
    structureRatioContribution(p.teamStructures, teamExpected);

  const peak = peakProximity(events.proximityHistory.get(p.unitId), p.now);
  a += PROXIMITY_WEIGHT * (2 * peak - 1);

  return clamp11(a);
};
