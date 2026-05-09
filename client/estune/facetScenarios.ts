/**
 * Facet trajectories: scripted scenarios that drive setFullGameState directly,
 * without going through the legacy phase machinery.
 *
 * A trajectory is a list of waypoints with absolute timestamps (seconds) and
 * the FullGameState at each one. The runner linearly interpolates facets
 * between waypoints. Boolean / structural fields snap to the next waypoint.
 */

import {
  type FullGameState, type GameMode, type Anticipation, type SheepFacets, type WolfFacets,
  type StructuralState, type Perspective,
} from "./types.ts";

export interface FacetWaypoint {
  /** Seconds from scenario start. */
  t: number;
  /** Optional label shown in UI. */
  label?: string;
  state: StructuralState;
  perspective: Perspective;
  sheep?: Partial<SheepFacets>;
  wolf?: Partial<WolfFacets>;
  /** Stinger to fire when this waypoint is reached. */
  stinger?: string;
  /** Anticipated upcoming events. Held for the duration of this waypoint;
   *  the engine reads them every tick and stages high-confidence ones. */
  anticipation?: Anticipation[];
}

export interface FacetScenario {
  name: string;
  /** Optional game mode; runner attaches it to every emitted FullGameState. */
  mode?: GameMode;
  waypoints: FacetWaypoint[];
  /** Round length passed to the engine for derived progress + endgame
   *  signals. Null/undefined defaults to the last waypoint's t (so legacy
   *  scenarios behave as if the scenario clock IS the round clock). */
  roundDurationSeconds?: number | null;
  /** Scenario timestamp at which the round timer starts. Defaults to 0
   *  (the scenario clock IS the round clock). roundTemplates sets this to
   *  the active-phase start so build/lobby seconds aren't billed against
   *  the round duration. */
  roundStartT?: number;
}

const DEFAULT_SHEEP: SheepFacets = {
  alive: true, threat: 0, agency: 0, isolation: 0,
  lastAlive: false,
};
const DEFAULT_WOLF: WolfFacets = {
  proximity: 0, agency: 0, isolation: 0,
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpSheep(a: SheepFacets, b: SheepFacets, t: number): SheepFacets {
  return {
    alive: t < 1 ? a.alive : b.alive,
    threat: lerp(a.threat, b.threat, t),
    agency: lerp(a.agency, b.agency, t),
    isolation: lerp(a.isolation, b.isolation, t),
    lastAlive: t < 1 ? a.lastAlive : b.lastAlive,
  };
}

function lerpWolf(a: WolfFacets, b: WolfFacets, t: number): WolfFacets {
  return {
    proximity: lerp(a.proximity, b.proximity, t),
    agency: lerp(a.agency, b.agency, t),
    isolation: lerp(a.isolation, b.isolation, t),
  };
}

/** Resolve a scenario at a given timestamp into a concrete FullGameState. */
export function evalScenario(scenario: FacetScenario, secondsFromStart: number): FullGameState | null {
  if (scenario.waypoints.length === 0) return null;

  // Find bracketing waypoints
  let prev = scenario.waypoints[0];
  let next = scenario.waypoints[scenario.waypoints.length - 1];

  for (let i = 0; i < scenario.waypoints.length - 1; i++) {
    if (scenario.waypoints[i].t <= secondsFromStart && scenario.waypoints[i + 1].t > secondsFromStart) {
      prev = scenario.waypoints[i];
      next = scenario.waypoints[i + 1];
      break;
    }
  }

  if (secondsFromStart < scenario.waypoints[0].t) {
    prev = scenario.waypoints[0];
    next = scenario.waypoints[0];
  }
  if (secondsFromStart >= scenario.waypoints[scenario.waypoints.length - 1].t) {
    prev = scenario.waypoints[scenario.waypoints.length - 1];
    next = prev;
  }

  const span = next.t - prev.t;
  const tNorm = span > 0 ? (secondsFromStart - prev.t) / span : 0;

  const prevSheep = { ...DEFAULT_SHEEP, ...prev.sheep };
  const nextSheep = { ...DEFAULT_SHEEP, ...next.sheep };
  const prevWolf = { ...DEFAULT_WOLF, ...prev.wolf };
  const nextWolf = { ...DEFAULT_WOLF, ...next.wolf };

  // Structural state and perspective snap to the next waypoint when we reach its t
  const state = tNorm >= 1 ? next.state : prev.state;
  const perspective = tNorm >= 1 ? next.perspective : prev.perspective;

  // Anticipation is held from the *prev* waypoint until we cross the next.
  // It's not interpolated — the game-side foreknowledge is binary per-window.
  const anticipation = prev.anticipation;

  // Round timing derived from scenario clock: last waypoint's t is the
  // implicit round duration unless the scenario set one explicitly. The
  // round timer starts at scenario.roundStartT (defaults to 0). Engine
  // skips endgame routing when state==="lobby" via its own state check, so
  // emitting elapsed/duration during lobby is a no-op for routing.
  const lastT = scenario.waypoints[scenario.waypoints.length - 1].t;
  const duration = scenario.roundDurationSeconds === undefined
    ? lastT
    : scenario.roundDurationSeconds;
  const startT = scenario.roundStartT ?? 0;
  const elapsed = state === "lobby"
    ? undefined
    : Math.max(0, secondsFromStart - startT);

  return {
    state, perspective,
    mode: scenario.mode,
    sheep: perspective === "wolf" ? undefined : lerpSheep(prevSheep, nextSheep, tNorm),
    wolf: perspective === "wolf" ? lerpWolf(prevWolf, nextWolf, tNorm) : undefined,
    roundHook: null,
    anticipation,
    roundElapsedSeconds: elapsed,
    roundDurationSeconds: duration,
  };
}

// ── Library of canonical scenarios ──

export const SHEEP_QUICK_LOSS: FacetScenario = {
  name: "Sheep quick loss",
  waypoints: [
    { t: 0,   label: "lobby",         state: "lobby", perspective: "sheep" },
    { t: 4,   label: "build phase",   state: "build", perspective: "sheep" },
    { t: 25,  label: "wolves spawn",  state: "active", perspective: "sheep",
      sheep: { threat: 0.15 } },
    { t: 40,  label: "tug of war",    state: "active", perspective: "sheep",
      sheep: { threat: 0.45, agency: -0.1 } },
    { t: 55,  label: "ally captured", state: "active", perspective: "sheep",
      sheep: { threat: 0.7, agency: -0.4, isolation: 0.6 },
      stinger: "capture" },
    { t: 60,  label: "last alive",    state: "active", perspective: "sheep",
      sheep: { threat: 0.85, agency: -0.6, isolation: 0.9, lastAlive: true } },
    { t: 75,  label: "captured",      state: "active", perspective: "sheep",
      sheep: { alive: false, threat: 0, agency: -0.8, isolation: 1 },
      stinger: "capture" },
    { t: 90,  label: "round end",     state: "active", perspective: "sheep",
      sheep: { alive: false, threat: 0, agency: -1, isolation: 1 },
      stinger: "sheep-loss-fade" },
    { t: 95,  label: "lobby",         state: "lobby", perspective: "sheep" },
  ],
};

export const SHEEP_RESCUED: FacetScenario = {
  name: "Sheep captured & rescued",
  waypoints: [
    { t: 0,   state: "lobby", perspective: "sheep" },
    { t: 4,   state: "build", perspective: "sheep" },
    { t: 25,  state: "active", perspective: "sheep",
      sheep: { threat: 0.15 } },
    { t: 50,  state: "active", perspective: "sheep",
      sheep: { threat: 0.5, agency: 0 } },
    { t: 65,  label: "captured",  state: "active", perspective: "sheep",
      sheep: { alive: false, threat: 0, isolation: 1 },
      stinger: "capture" },
    { t: 85,  label: "rescued",   state: "active", perspective: "sheep",
      sheep: { alive: true, threat: 0.4, agency: 0.2, isolation: 0.2 },
      stinger: "rescue" },
    { t: 110, state: "active", perspective: "sheep",
      sheep: { threat: 0.3, agency: 0.4 } },
    { t: 120, state: "lobby", perspective: "sheep" },
  ],
};

export const WOLF_HUNT: FacetScenario = {
  name: "Wolf hunt",
  waypoints: [
    { t: 0,   state: "lobby", perspective: "wolf" },
    { t: 4,   state: "build", perspective: "wolf" },
    { t: 25,  state: "active", perspective: "wolf",
      wolf: { proximity: 0.1, agency: 0.2 } },
    { t: 50,  state: "active", perspective: "wolf",
      wolf: { proximity: 0.5, agency: 0.4 } },
    { t: 70,  state: "active", perspective: "wolf",
      wolf: { proximity: 0.9, agency: 0.7 } },
    { t: 80,  state: "active", perspective: "wolf",
      wolf: { proximity: 0.4, agency: 0.5 } },
    { t: 95,  state: "lobby", perspective: "wolf" },
  ],
};

export const ALL_FACET_SCENARIOS = [SHEEP_QUICK_LOSS, SHEEP_RESCUED, WOLF_HUNT];

// ── Scenario runner ──

export interface FacetScenarioRunner {
  scenario: FacetScenario;
  startTime: number;
  intervalId: number | null;
  firedStingers: Set<number>;
  onStep: (state: FullGameState, label?: string) => void;
  onStinger: (id: string) => void;
  onComplete: () => void;
}

export function runFacetScenario(
  scenario: FacetScenario,
  onStep: (state: FullGameState, label?: string) => void,
  onStinger: (id: string) => void,
  onComplete: () => void,
): FacetScenarioRunner {
  const runner: FacetScenarioRunner = {
    scenario,
    startTime: performance.now() / 1000,
    intervalId: null,
    firedStingers: new Set(),
    onStep, onStinger, onComplete,
  };

  const tick = () => {
    const elapsed = performance.now() / 1000 - runner.startTime;
    const state = evalScenario(scenario, elapsed);
    if (!state) return;

    // Find current waypoint label
    let currentLabel: string | undefined;
    for (let i = scenario.waypoints.length - 1; i >= 0; i--) {
      if (scenario.waypoints[i].t <= elapsed) {
        currentLabel = scenario.waypoints[i].label;
        break;
      }
    }
    onStep(state, currentLabel);

    // Fire stingers when crossing waypoint boundaries
    for (let i = 0; i < scenario.waypoints.length; i++) {
      const wp = scenario.waypoints[i];
      if (wp.stinger && elapsed >= wp.t && !runner.firedStingers.has(i)) {
        runner.firedStingers.add(i);
        onStinger(wp.stinger);
      }
    }

    const lastT = scenario.waypoints[scenario.waypoints.length - 1].t;
    if (elapsed >= lastT) {
      stopFacetScenario(runner);
      onComplete();
    }
  };

  runner.intervalId = setInterval(tick, 100) as unknown as number;
  tick();
  return runner;
}

export function stopFacetScenario(runner: FacetScenarioRunner): void {
  if (runner.intervalId !== null) {
    clearInterval(runner.intervalId);
    runner.intervalId = null;
  }
}
