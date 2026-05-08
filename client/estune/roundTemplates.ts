/**
 * Round templates: procedurally generate FacetScenario waypoints from a
 * (team format, outcome, perspective) tuple.
 *
 * Models a full round arc: lobby → build (21s) → active (variable) → lobby.
 * Outcome shapes are derived from the catalogue's canonical timelines
 * (see docs/song-timelines.md).
 *
 * Used by the UI's "auto" mode and by sample-rendering scripts.
 */

import {
  type FacetScenario, type FacetWaypoint,
} from "./facetScenarios.ts";
import { type Perspective, type GameMode, type Anticipation } from "./types.ts";

export type SheepCount = 1 | 2 | 3 | 5;
export type WolfCount = 3 | 4 | 5;
export type TeamFormat = "1v3" | "2v4" | "3v5" | "5v5";

export const TEAM_FORMATS: { format: TeamFormat; sheep: SheepCount; wolves: WolfCount }[] = [
  { format: "1v3", sheep: 1, wolves: 3 },
  { format: "2v4", sheep: 2, wolves: 4 },
  { format: "3v5", sheep: 3, wolves: 5 },
  { format: "5v5", sheep: 5, wolves: 5 },
];

export type Outcome =
  | "instant-loss"
  | "quick-loss"
  | "standard-loss"
  | "rescue-loss"
  | "late-loss"
  | "win";

export const OUTCOMES: Outcome[] = [
  "instant-loss", "quick-loss", "standard-loss", "rescue-loss", "late-loss", "win",
];

export const OUTCOME_WEIGHTS: Record<Outcome, number> = {
  // From docs/v3-song-design.md: % of rounds at each pacing
  "instant-loss": 0.16,
  "quick-loss": 0.29,
  "standard-loss": 0.20,
  "rescue-loss": 0.10,
  "late-loss": 0.24,
  "win": 0.01,
};

export interface RoundTemplate {
  format: TeamFormat;
  outcome: Outcome;
  perspective: Perspective;
  /** Optional seed for deterministic variation. */
  seed?: number;
  /** Game mode. Drives default buildDuration and lobbyHead, plus
   *  bridge intensity at runtime. Defaults to "survival". */
  mode?: GameMode;
  /** Explicit override for build-phase length (seconds). Defaults to the
   *  mode's value: standard=21, switch=2, bulldog=0. */
  buildDuration?: number;
  /** Explicit override for lobby-head length (seconds). Defaults to the
   *  mode's value: standard=6, switch=6, bulldog=2. */
  lobbyHead?: number;
}

/** Per-mode timing defaults. Mirrors emoji-sheep-tag's mode behavior.
 *  vip and vamp use survival timing (3s countdown + 18s head start).
 *  switch shortens the head start to 2s. bulldog has wolves spawn with sheep. */
const MODE_DEFAULTS: Record<GameMode, { buildDuration: number; lobbyHead: number }> = {
  survival: { buildDuration: 21, lobbyHead: 6 },
  vip:      { buildDuration: 21, lobbyHead: 6 },
  vamp:     { buildDuration: 21, lobbyHead: 6 },
  switch:   { buildDuration: 2,  lobbyHead: 6 },
  bulldog:  { buildDuration: 0,  lobbyHead: 2 },
};

/** Catalogue-anchored *active-phase* duration per outcome, in seconds.
 *  These match the catalogue songs (R1S=22s active, R3S=85s, etc). For longer
 *  formats they're used as a floor and clamped against the format's ideal time;
 *  see `getActiveDurationFor`. */
const OUTCOME_ACTIVE_DURATION: Record<Outcome, number> = {
  "instant-loss": 22,
  "quick-loss": 45,
  "standard-loss": 85,
  "rescue-loss": 85,
  "late-loss": 165,
  "win": 340, // overridden per-format: a win lasts the format's ideal time
};

const LOBBY_TAIL = 6;              // seconds of lobby after round end

/** Ideal round duration per format, from emoji-sheep-tag's getIdealTime().
 *  This is the active-phase time used to compute roundProgress = elapsed/ideal. */
const IDEAL_ROUND_SECONDS: Record<TeamFormat, number> = {
  "1v3": 180,   // 3 minutes
  "2v4": 360,   // 6 minutes
  "3v5": 480,   // 8 minutes
  "5v5": 900,   // 15 minutes
};

/** Bulldog rounds are a fixed 90s regardless of format
 *  (emoji-sheep-tag/server/st/roundHelpers.ts:BULLDOG_TIME). */
const BULLDOG_IDEAL_SECONDS = 90;

export function getIdealRoundSeconds(
  format: TeamFormat,
  mode: GameMode = "survival",
): number {
  if (mode === "bulldog") return BULLDOG_IDEAL_SECONDS;
  return IDEAL_ROUND_SECONDS[format];
}

/** Active-phase duration for a (format, outcome, mode) triple.
 *  - "win" pegs to the format's ideal time (the round ended via timer).
 *  - "late-loss" lives in the 50%–95% bracket of ideal — the round nearly went
 *    the distance but ended before the timer. Anchored at 75% of ideal.
 *  - Other outcomes use the catalogue value if it fits, otherwise scale down
 *    proportionally so e.g. a 1v3 (180s ideal) doesn't get a 340s arc. */
export function getActiveDurationFor(
  outcome: Outcome,
  format: TeamFormat,
  mode: GameMode = "survival",
): number {
  const ideal = getIdealRoundSeconds(format, mode);
  if (outcome === "win") return ideal;
  if (outcome === "late-loss") return ideal * 0.75;
  const base = OUTCOME_ACTIVE_DURATION[outcome];
  return Math.min(base, ideal * 0.9);
}

/** Total scenario duration (lobby head + build + active + lobby tail). */
export function getOutcomeDuration(
  outcome: Outcome,
  format: TeamFormat = "2v4",
  mode: GameMode = "survival",
): number {
  const m = MODE_DEFAULTS[mode];
  return m.lobbyHead + m.buildDuration + getActiveDurationFor(outcome, format, mode) + LOBBY_TAIL;
}

/** Pick an outcome with realistic-ish probability weights. */
export function pickRandomOutcome(rng: () => number = Math.random): Outcome {
  const r = rng();
  let acc = 0;
  for (const o of OUTCOMES) {
    acc += OUTCOME_WEIGHTS[o];
    if (r < acc) return o;
  }
  return "quick-loss";
}

/** Pick a random team format (uniform). */
export function pickRandomFormat(rng: () => number = Math.random): TeamFormat {
  const idx = Math.floor(rng() * TEAM_FORMATS.length);
  return TEAM_FORMATS[idx].format;
}

// ── Scenario generation ──

/**
 * Generate a complete FacetScenario for the given round template.
 *
 * Layout:
 *   t=0 .. LOBBY_HEAD                 : lobby
 *   t=LOBBY_HEAD .. +BUILD_DURATION   : build (21s)
 *   t=...        .. +activeDuration   : active (outcome-specific)
 *   t=last       .. +LOBBY_TAIL       : lobby (resolution)
 */
export function generateScenario(template: RoundTemplate): FacetScenario {
  const mode: GameMode = template.mode ?? "survival";
  const modeDefaults = MODE_DEFAULTS[mode];
  const buildDuration = template.buildDuration ?? modeDefaults.buildDuration;
  const lobbyHead = template.lobbyHead ?? modeDefaults.lobbyHead;
  const tBuildStart = lobbyHead;
  const tActiveStart = tBuildStart + buildDuration;
  // Active-phase length is format-/mode-aware: a "win" arc lasts the format's
  // ideal round time (90s flat for bulldog), other outcomes are clamped
  // against ideal so we never generate a song longer than the round could run.
  const activeDuration = getActiveDurationFor(template.outcome, template.format, mode);
  const tActiveEnd = tActiveStart + activeDuration;
  const totalDuration = tActiveEnd + LOBBY_TAIL;

  const waypoints: FacetWaypoint[] = [];

  // Lobby head
  waypoints.push({ t: 0, label: "lobby", state: "lobby", perspective: template.perspective });

  // Build phase — only emit if buildDuration > 0. Bulldog skips build entirely.
  if (buildDuration > 0) {
    waypoints.push({
      t: tBuildStart,
      label: template.perspective === "wolf" ? "wolf wait" : "build phase",
      state: "build",
      perspective: template.perspective,
    });
  }

  // Active phase — delegated per outcome.
  // We post-process to (a) overwrite roundProgress with elapsed/idealActive,
  // (b) inject a peak-threat waypoint immediately before each capture so
  // threat doesn't sag while the sheep is still alive, and (c) back-fill
  // anticipation events ahead of rescue stingers so the engine pre-swells.
  const rawActive = generateActivePhase(template, tActiveStart, tActiveEnd);
  const idealActive = getIdealRoundSeconds(template.format, mode);
  const activeWaypoints = injectAnticipations(
    injectPreCapturePeaks(
      overwriteRoundProgress(rawActive, tActiveStart, idealActive),
    ),
  );
  waypoints.push(...activeWaypoints);

  // Lobby tail (resolution)
  waypoints.push({
    t: totalDuration,
    label: "lobby",
    state: "lobby",
    perspective: template.perspective,
  });

  return {
    name: `${template.format} ${template.outcome} (${template.perspective})`,
    mode,
    waypoints,
  };
}

/** Replace each waypoint's roundProgress with elapsed/idealActive (capped 0..1). */
function overwriteRoundProgress(
  waypoints: FacetWaypoint[],
  tActiveStart: number,
  idealActive: number,
): FacetWaypoint[] {
  return waypoints.map(w => {
    const prog = Math.max(0, Math.min(1, (w.t - tActiveStart) / idealActive));
    if (w.sheep) {
      return { ...w, sheep: { ...w.sheep, roundProgress: prog } };
    }
    if (w.wolf) {
      return {
        ...w,
        wolf: {
          ...w.wolf,
          roundProgress: prog,
        },
      };
    }
    return w;
  });
}

/** Back-fill anticipation events upstream of rescue stinger waypoints so the
 *  engine's pre-swell handler stages the rescue 4s ahead of the actual moment.
 *  Insert a synthetic anticipation waypoint at (rescue.t - lead) when there's
 *  room; otherwise attach the anticipation onto the last waypoint within the
 *  lead window (carried forward by evalScenario until the rescue lands). */
function injectAnticipations(waypoints: FacetWaypoint[]): FacetWaypoint[] {
  const RESCUE_LEAD = 4;
  const RESCUE_CONFIDENCE = 0.9;
  const out: FacetWaypoint[] = [];

  for (let i = 0; i < waypoints.length; i++) {
    const w = waypoints[i];
    const prev = waypoints[i - 1];
    const isRescue = w.stinger === "rescue";

    if (isRescue && prev) {
      const targetT = w.t - RESCUE_LEAD;
      if (prev.t < targetT) {
        // Plenty of room — insert a synthetic anticipation waypoint that
        // mirrors prev's facets but carries the anticipation array.
        const ant: Anticipation = {
          event: "rescue", lead: RESCUE_LEAD, confidence: RESCUE_CONFIDENCE,
        };
        out.push({
          t: targetT,
          label: "rescue inbound",
          state: prev.state,
          perspective: prev.perspective,
          sheep: prev.sheep ? { ...prev.sheep } : undefined,
          wolf: prev.wolf ? { ...prev.wolf } : undefined,
          anticipation: [ant],
        });
      } else {
        // Lead window is shorter than RESCUE_LEAD — attach what time we have
        // onto the previous waypoint already in the output.
        const lead = w.t - prev.t;
        if (lead >= 1.5) {
          const last = out[out.length - 1];
          if (last && last.t === prev.t) {
            out[out.length - 1] = {
              ...last,
              anticipation: [{ event: "rescue", lead, confidence: RESCUE_CONFIDENCE }],
            };
          }
        }
      }
    }
    out.push(w);
  }
  return out;
}

/** Insert a peak-threat waypoint 0.5s before each "captured" event so threat
 *  stays high until the moment of capture instead of sagging linearly. */
function injectPreCapturePeaks(waypoints: FacetWaypoint[]): FacetWaypoint[] {
  const out: FacetWaypoint[] = [];
  for (let i = 0; i < waypoints.length; i++) {
    const w = waypoints[i];
    const prev = waypoints[i - 1];
    const isCaptureMoment =
      (w.sheep && w.sheep.alive === false && prev?.sheep?.alive !== false) ||
      (w.label === "captured" || w.label === "captured again" || w.label === "you captured");
    if (isCaptureMoment && prev && w.t - prev.t > 0.6) {
      const peakT = w.t - 0.5;
      if (w.sheep) {
        out.push({
          ...w,
          t: peakT,
          label: "terror peak",
          sheep: { ...w.sheep, alive: true, threat: 1, isolation: 1 },
          stinger: undefined,
        });
      } else if (w.wolf) {
        out.push({
          ...w,
          t: peakT,
          label: "kill imminent",
          wolf: { ...w.wolf, proximity: 1 },
          stinger: undefined,
        });
      }
    }
    out.push(w);
  }
  return out;
}

// ── Active-phase generators per outcome ──

function generateActivePhase(
  template: RoundTemplate,
  tStart: number,
  tEnd: number,
): FacetWaypoint[] {
  switch (template.outcome) {
    case "instant-loss": return instantLoss(template, tStart, tEnd);
    case "quick-loss": return quickLoss(template, tStart, tEnd);
    case "standard-loss": return standardLoss(template, tStart, tEnd);
    case "rescue-loss": return rescueLoss(template, tStart, tEnd);
    case "late-loss": return lateLoss(template, tStart, tEnd);
    case "win": return win(template, tStart, tEnd);
  }
}

/** Helper: build a sheep or wolf waypoint based on perspective. */
function wp(
  t: number, label: string | undefined, perspective: Perspective,
  sheep: Partial<{
    alive: boolean; threat: number; agency: number; isolation: number;
    lastAlive: boolean; roundProgress: number;
  }>,
  stinger?: string,
): FacetWaypoint {
  // Translate sheep facets to wolf facets when perspective is wolf:
  //  threat (sheep being chased) → proximity (wolf chasing)
  //  agency inverts: sheep -0.5 = wolf +0.5
  //  isolation: wolves don't care about pack distance — leave at 0
  //  lastAlive sheep ≈ wolf in attack mode
  if (perspective === "wolf") {
    const sheepThreat = sheep.threat ?? 0;
    const sheepAgency = sheep.agency ?? 0;
    const roundProgress = sheep.roundProgress ?? 0;
    return {
      t, label, state: "active", perspective: "wolf",
      wolf: {
        proximity: sheepThreat,
        agency: -sheepAgency,
        isolation: 0,
        roundProgress,
      },
      stinger,
    };
  }
  return {
    t, label, state: "active", perspective: "sheep",
    sheep: {
      alive: sheep.alive ?? true,
      threat: sheep.threat ?? 0,
      agency: sheep.agency ?? 0,
      isolation: sheep.isolation ?? 0,
      lastAlive: sheep.lastAlive ?? false,
      roundProgress: sheep.roundProgress ?? 0,
    },
    stinger,
  };
}

/** Get isolation given team format and current capture state. */
function isolationFor(format: TeamFormat, capturesSoFar: number): number {
  const sheepCount = formatToSheepCount(format);
  const remaining = sheepCount - capturesSoFar;
  if (remaining <= 1) return 0.95;
  if (remaining === 2) return 0.5;
  if (remaining === 3) return 0.3;
  return 0.15; // 4-5 sheep
}

function lastAliveFor(format: TeamFormat, capturesSoFar: number): boolean {
  return formatToSheepCount(format) - capturesSoFar === 1;
}

function formatToSheepCount(format: TeamFormat): SheepCount {
  return TEAM_FORMATS.find(t => t.format === format)!.sheep;
}

// ── Per-outcome arcs ──

function instantLoss(t: RoundTemplate, t0: number, t1: number): FacetWaypoint[] {
  const span = t1 - t0;
  const isSolo = formatToSheepCount(t.format) === 1;
  if (isSolo) {
    return [
      wp(t0, "wolves spawn", t.perspective,
        { threat: 0.2, roundProgress: 0.05, isolation: isolationFor(t.format, 0), lastAlive: true }),
      wp(t0 + span * 0.4, "panic", t.perspective,
        { threat: 0.7, agency: -0.4, roundProgress: 0.3,
          isolation: 0.95, lastAlive: true }),
      wp(t0 + span * 0.75, "captured", t.perspective,
        { alive: false, threat: 0, agency: -0.9, roundProgress: 0.8, isolation: 1 },
        "capture"),
      wp(t1, "round end", t.perspective,
        { alive: false, agency: -1, roundProgress: 1 },
        "sheep-loss-fade"),
    ];
  }
  return [
    wp(t0, "wolves spawn", t.perspective,
      { threat: 0.2, roundProgress: 0.05, isolation: isolationFor(t.format, 0) }),
    wp(t0 + span * 0.3, "panic", t.perspective,
      { threat: 0.55, agency: -0.2, roundProgress: 0.2,
        isolation: isolationFor(t.format, 0) }),
    wp(t0 + span * 0.55, "ally captured", t.perspective,
      { threat: 0.8, agency: -0.5, roundProgress: 0.4,
        isolation: isolationFor(t.format, 1),
        lastAlive: lastAliveFor(t.format, 1) },
      "capture"),
    wp(t0 + span * 0.85, "captured", t.perspective,
      { alive: false, threat: 0, agency: -0.9, roundProgress: 0.85, isolation: 1 },
      "capture"),
    wp(t1, "round end", t.perspective,
      { alive: false, agency: -1, roundProgress: 1 },
      "sheep-loss-fade"),
  ];
}

function quickLoss(t: RoundTemplate, t0: number, t1: number): FacetWaypoint[] {
  const span = t1 - t0;
  const isSolo = formatToSheepCount(t.format) === 1;
  if (isSolo) {
    return [
      wp(t0, "wolves spawn", t.perspective,
        { threat: 0.15, roundProgress: 0.05, isolation: isolationFor(t.format, 0), lastAlive: true }),
      wp(t0 + span * 0.3, "tug of war", t.perspective,
        { threat: 0.5, agency: -0.2, roundProgress: 0.25,
          isolation: 0.95, lastAlive: true }),
      wp(t0 + span * 0.65, "last stand", t.perspective,
        { threat: 0.85, agency: -0.6, roundProgress: 0.6,
          isolation: 0.95, lastAlive: true }),
      wp(t0 + span * 0.93, "captured", t.perspective,
        { alive: false, threat: 0, agency: -0.8, roundProgress: 0.9, isolation: 1 },
        "capture"),
      wp(t1, "round end", t.perspective,
        { alive: false, agency: -1, roundProgress: 1 },
        "sheep-loss-fade"),
    ];
  }
  return [
    wp(t0, "wolves spawn", t.perspective,
      { threat: 0.15, roundProgress: 0.05, isolation: isolationFor(t.format, 0) }),
    wp(t0 + span * 0.25, "tug of war", t.perspective,
      { threat: 0.45, agency: -0.1, roundProgress: 0.2,
        isolation: isolationFor(t.format, 0) }),
    wp(t0 + span * 0.5, "ally captured", t.perspective,
      { threat: 0.7, agency: -0.4, roundProgress: 0.4,
        isolation: isolationFor(t.format, 1),
        lastAlive: lastAliveFor(t.format, 1) },
      "capture"),
    wp(t0 + span * 0.7, "last stand", t.perspective,
      { threat: 0.85, agency: -0.6, roundProgress: 0.6,
        isolation: 0.95, lastAlive: true }),
    wp(t0 + span * 0.93, "captured", t.perspective,
      { alive: false, threat: 0, agency: -0.8, roundProgress: 0.9, isolation: 1 },
      "capture"),
    wp(t1, "round end", t.perspective,
      { alive: false, agency: -1, roundProgress: 1 },
      "sheep-loss-fade"),
  ];
}

function standardLoss(t: RoundTemplate, t0: number, t1: number): FacetWaypoint[] {
  const span = t1 - t0;
  const isSolo = formatToSheepCount(t.format) === 1;
  if (isSolo) {
    return [
      wp(t0, "wolves spawn", t.perspective,
        { threat: 0.15, roundProgress: 0.05, isolation: isolationFor(t.format, 0), lastAlive: true }),
      wp(t0 + span * 0.25, "settling in", t.perspective,
        { threat: 0.35, agency: 0.1, roundProgress: 0.2,
          isolation: 0.95, lastAlive: true }),
      wp(t0 + span * 0.5, "intensifying", t.perspective,
        { threat: 0.55, agency: -0.2, roundProgress: 0.45,
          isolation: 0.95, lastAlive: true }),
      wp(t0 + span * 0.75, "wearing down", t.perspective,
        { threat: 0.8, agency: -0.5, roundProgress: 0.7,
          isolation: 0.95, lastAlive: true }),
      wp(t0 + span * 0.92, "last stand", t.perspective,
        { threat: 0.9, agency: -0.7, roundProgress: 0.85,
          isolation: 0.95, lastAlive: true }),
      wp(t1 - 4, "captured", t.perspective,
        { alive: false, threat: 0, agency: -0.9, roundProgress: 0.95, isolation: 1 },
        "capture"),
      wp(t1, "round end", t.perspective,
        { alive: false, agency: -1, roundProgress: 1 },
        "sheep-loss-fade"),
    ];
  }
  return [
    wp(t0, "wolves spawn", t.perspective,
      { threat: 0.15, roundProgress: 0.05, isolation: isolationFor(t.format, 0) }),
    wp(t0 + span * 0.2, "settling in", t.perspective,
      { threat: 0.35, agency: 0.1, roundProgress: 0.15,
        isolation: isolationFor(t.format, 0) }),
    wp(t0 + span * 0.4, "intensifying", t.perspective,
      { threat: 0.5, agency: -0.1, roundProgress: 0.3,
        isolation: isolationFor(t.format, 0) }),
    wp(t0 + span * 0.55, "fragmenting", t.perspective,
      { threat: 0.65, agency: -0.3, roundProgress: 0.45,
        isolation: isolationFor(t.format, 0) }),
    wp(t0 + span * 0.7, "ally captured", t.perspective,
      { threat: 0.7, agency: -0.5, roundProgress: 0.6,
        isolation: isolationFor(t.format, 1),
        lastAlive: lastAliveFor(t.format, 1) },
      "capture"),
    wp(t0 + span * 0.85, "last stand", t.perspective,
      { threat: 0.9, agency: -0.7, roundProgress: 0.8,
        isolation: 0.95, lastAlive: true }),
    wp(t1 - 4, "captured", t.perspective,
      { alive: false, threat: 0, agency: -0.9, roundProgress: 0.95, isolation: 1 },
      "capture"),
    wp(t1, "round end", t.perspective,
      { alive: false, agency: -1, roundProgress: 1 },
      "sheep-loss-fade"),
  ];
}

function rescueLoss(t: RoundTemplate, t0: number, t1: number): FacetWaypoint[] {
  const span = t1 - t0;
  const isSolo = formatToSheepCount(t.format) === 1;
  // For solo: no ally to rescue you, so collapse to standard loss
  if (isSolo) return standardLoss(t, t0, t1);
  return [
    wp(t0, "wolves spawn", t.perspective,
      { threat: 0.15, roundProgress: 0.05, isolation: isolationFor(t.format, 0) }),
    wp(t0 + span * 0.2, "mid-game", t.perspective,
      { threat: 0.4, agency: 0, roundProgress: 0.15,
        isolation: isolationFor(t.format, 0) }),
    wp(t0 + span * 0.35, "captured", t.perspective,
      { alive: false, threat: 0, agency: -0.4, isolation: 1, roundProgress: 0.3 },
      "capture"),
    wp(t0 + span * 0.5, "spirit watching", t.perspective,
      { alive: false, threat: 0, agency: -0.2, isolation: 1, roundProgress: 0.4 }),
    wp(t0 + span * 0.6, "rescued!", t.perspective,
      { alive: true, threat: 0.4, agency: 0.2, isolation: 0.3, roundProgress: 0.5 },
      "rescue"),
    wp(t0 + span * 0.75, "back in fight", t.perspective,
      { threat: 0.6, agency: 0, isolation: 0.2, roundProgress: 0.65 }),
    wp(t0 + span * 0.88, "ally captured", t.perspective,
      { threat: 0.85, agency: -0.6, roundProgress: 0.85,
        isolation: 0.9, lastAlive: lastAliveFor(t.format, 1) },
      "capture"),
    wp(t1 - 3, "captured again", t.perspective,
      { alive: false, threat: 0, agency: -0.9, roundProgress: 0.95, isolation: 1 },
      "capture"),
    wp(t1, "round end", t.perspective,
      { alive: false, agency: -1, roundProgress: 1 },
      "sheep-loss-fade"),
  ];
}

function lateLoss(t: RoundTemplate, t0: number, t1: number): FacetWaypoint[] {
  const span = t1 - t0;
  const isSolo = formatToSheepCount(t.format) === 1;
  if (isSolo) {
    return [
      wp(t0, "wolves spawn", t.perspective,
        { threat: 0.15, roundProgress: 0.03, isolation: isolationFor(t.format, 0), lastAlive: true }),
      wp(t0 + span * 0.2, "long mid-game", t.perspective,
        { threat: 0.4, agency: 0.05, roundProgress: 0.18, isolation: 0.95, lastAlive: true }),
      wp(t0 + span * 0.45, "near miss", t.perspective,
        { threat: 0.6, agency: 0, roundProgress: 0.4, isolation: 0.95, lastAlive: true }),
      wp(t0 + span * 0.65, "grinding", t.perspective,
        { threat: 0.65, agency: -0.2, roundProgress: 0.6, isolation: 0.95, lastAlive: true }),
      wp(t0 + span * 0.85, "wearing down", t.perspective,
        { threat: 0.85, agency: -0.6, roundProgress: 0.85, isolation: 0.95, lastAlive: true }),
      wp(t1 - 4, "captured", t.perspective,
        { alive: false, threat: 0, agency: -0.95, roundProgress: 0.97, isolation: 1 },
        "capture"),
      wp(t1, "round end", t.perspective,
        { alive: false, agency: -1, roundProgress: 1 },
        "sheep-loss-fade"),
    ];
  }
  return [
    wp(t0, "wolves spawn", t.perspective,
      { threat: 0.15, roundProgress: 0.03, isolation: isolationFor(t.format, 0) }),
    wp(t0 + span * 0.15, "long mid-game", t.perspective,
      { threat: 0.35, agency: 0.05, roundProgress: 0.1,
        isolation: isolationFor(t.format, 0) }),
    wp(t0 + span * 0.3, "ally captured", t.perspective,
      { threat: 0.55, agency: -0.3, roundProgress: 0.25,
        isolation: isolationFor(t.format, 1),
        lastAlive: lastAliveFor(t.format, 1) },
      "capture"),
    wp(t0 + span * 0.4, "rescued", t.perspective,
      { threat: 0.4, agency: 0, isolation: isolationFor(t.format, 0), roundProgress: 0.35 },
      "rescue"),
    wp(t0 + span * 0.55, "grinding", t.perspective,
      { threat: 0.55, agency: -0.2, roundProgress: 0.5,
        isolation: isolationFor(t.format, 0) }),
    wp(t0 + span * 0.7, "ally captured again", t.perspective,
      { threat: 0.7, agency: -0.5, roundProgress: 0.65,
        isolation: isolationFor(t.format, 1),
        lastAlive: lastAliveFor(t.format, 1) },
      "capture"),
    wp(t0 + span * 0.85, "wearing down", t.perspective,
      { threat: 0.85, agency: -0.7, roundProgress: 0.85,
        isolation: 0.9, lastAlive: lastAliveFor(t.format, 1) }),
    wp(t1 - 4, "captured", t.perspective,
      { alive: false, threat: 0, agency: -0.95, roundProgress: 0.97, isolation: 1 },
      "capture"),
    wp(t1, "round end", t.perspective,
      { alive: false, agency: -1, roundProgress: 1 },
      "sheep-loss-fade"),
  ];
}

function win(t: RoundTemplate, t0: number, t1: number): FacetWaypoint[] {
  const span = t1 - t0;
  const isSolo = formatToSheepCount(t.format) === 1;
  if (isSolo) {
    return [
      wp(t0, "wolves spawn", t.perspective,
        { threat: 0.15, roundProgress: 0.03, isolation: isolationFor(t.format, 0), lastAlive: true }),
      wp(t0 + span * 0.15, "evading", t.perspective,
        { threat: 0.4, agency: 0.1, roundProgress: 0.15, isolation: 0.95, lastAlive: true }),
      wp(t0 + span * 0.4, "near miss", t.perspective,
        { threat: 0.65, agency: 0, roundProgress: 0.4, isolation: 0.95, lastAlive: true }),
      wp(t0 + span * 0.6, "outlasting", t.perspective,
        { threat: 0.5, agency: 0.3, roundProgress: 0.6, isolation: 0.9, lastAlive: true }),
      wp(t0 + span * 0.8, "winning", t.perspective,
        { threat: 0.35, agency: 0.6, roundProgress: 0.8, isolation: 0.8, lastAlive: true }),
      wp(t0 + span * 0.93, "victory crescendo", t.perspective,
        { threat: 0.2, agency: 0.9, roundProgress: 0.93, isolation: 0.7, lastAlive: true }),
      wp(t1 - 2, "SHEEP WIN", t.perspective,
        { threat: 0, agency: 1, roundProgress: 1, lastAlive: true },
        "rescue"),
      wp(t1, "round end", t.perspective,
        { agency: 1, roundProgress: 1 }),
    ];
  }
  return [
    wp(t0, "wolves spawn", t.perspective,
      { threat: 0.15, roundProgress: 0.03, isolation: isolationFor(t.format, 0) }),
    wp(t0 + span * 0.1, "confident mid-game", t.perspective,
      { threat: 0.3, agency: 0.2, roundProgress: 0.08,
        isolation: isolationFor(t.format, 0) }),
    wp(t0 + span * 0.25, "ally captured", t.perspective,
      { threat: 0.55, agency: -0.2, roundProgress: 0.22,
        isolation: isolationFor(t.format, 1),
        lastAlive: lastAliveFor(t.format, 1) },
      "capture"),
    wp(t0 + span * 0.32, "rescued!", t.perspective,
      { threat: 0.4, agency: 0.1, isolation: isolationFor(t.format, 0), roundProgress: 0.3 },
      "rescue"),
    wp(t0 + span * 0.42, "you captured", t.perspective,
      { alive: false, threat: 0, agency: -0.3, isolation: 1, roundProgress: 0.4 },
      "capture"),
    wp(t0 + span * 0.55, "rescued again!", t.perspective,
      { alive: true, threat: 0.4, agency: 0.2, isolation: 0.2, roundProgress: 0.52 },
      "rescue"),
    wp(t0 + span * 0.7, "winning", t.perspective,
      { threat: 0.4, agency: 0.5, isolation: 0.1, roundProgress: 0.68 }),
    wp(t0 + span * 0.82, "playful", t.perspective,
      { threat: 0.3, agency: 0.7, isolation: 0.1, roundProgress: 0.8 }),
    wp(t0 + span * 0.93, "victory crescendo", t.perspective,
      { threat: 0.2, agency: 0.9, isolation: 0.05, roundProgress: 0.93 }),
    wp(t1 - 2, "SHEEP WIN", t.perspective,
      { threat: 0, agency: 1, roundProgress: 1 },
      "rescue"),
    wp(t1, "round end", t.perspective,
      { agency: 1, roundProgress: 1 }),
  ];
}
