/**
 * Round simulator: auto-progresses through game phases for UX testing.
 * Each scenario is a timeline of phase changes with durations.
 */

import { type GamePhase } from "./types.ts";

export interface PhaseStep {
  phase: GamePhase;
  /** Duration in seconds before advancing to next step. */
  duration: number;
  /** Label shown in UI. */
  label: string;
}

export type Scenario = PhaseStep[];

// ── Sheep perspective scenarios ──

export const SHEEP_WIN: Scenario = [
  { phase: "intermission-pre", duration: 12, label: "Lobby" },
  { phase: "sheep-prep", duration: 18, label: "Building obstacles" },
  { phase: "early", duration: 12, label: "Wolves spawned!" },
  { phase: "early-mid", duration: 25, label: "Mid game" },
  { phase: "mid", duration: 30, label: "Mid game" },
  { phase: "late-dominant", duration: 20, label: "Sheep pulling ahead" },
  { phase: "victory-build", duration: 15, label: "Almost there..." },
  { phase: "victory", duration: 8, label: "SHEEP WIN!" },
  { phase: "intermission-between", duration: 10, label: "Between rounds" },
];

export const SHEEP_CAPTURED_RESCUED: Scenario = [
  { phase: "intermission-pre", duration: 6, label: "Lobby" },
  { phase: "sheep-prep", duration: 18, label: "Building obstacles" },
  { phase: "early", duration: 10, label: "Wolves spawned!" },
  { phase: "early-mid", duration: 20, label: "Mid game" },
  { phase: "spirit", duration: 18, label: "Captured!" },
  { phase: "rescue", duration: 6, label: "Rescued!!" },
  { phase: "early-mid", duration: 20, label: "Back in the fight" },
  { phase: "mid", duration: 15, label: "Mid game" },
  { phase: "round-end-wolves", duration: 8, label: "Wolves win" },
  { phase: "intermission-between", duration: 8, label: "Between rounds" },
];

export const SHEEP_LAST_STAND: Scenario = [
  { phase: "intermission-pre", duration: 6, label: "Lobby" },
  { phase: "sheep-prep", duration: 18, label: "Building obstacles" },
  { phase: "early", duration: 10, label: "Wolves spawned!" },
  { phase: "early-mid", duration: 20, label: "Mid game" },
  { phase: "mid", duration: 20, label: "Mid game" },
  { phase: "last-stand", duration: 25, label: "Last sheep alive!" },
  { phase: "victory-build", duration: 12, label: "Holding on..." },
  { phase: "victory", duration: 8, label: "SHEEP WIN!" },
  { phase: "intermission-between", duration: 8, label: "Between rounds" },
];

// ── Wolf perspective scenarios ──

export const WOLF_QUICK_WIN: Scenario = [
  { phase: "intermission-pre", duration: 6, label: "Lobby" },
  { phase: "wolf-wait", duration: 18, label: "Waiting to spawn..." },
  { phase: "early", duration: 15, label: "Hunting" },
  { phase: "early-mid", duration: 20, label: "Organizing" },
  { phase: "mid", duration: 15, label: "Pressing advantage" },
  { phase: "round-end-wolves", duration: 8, label: "Wolves win!" },
  { phase: "intermission-between", duration: 8, label: "Between rounds" },
];

export const WOLF_DESPERATE_LOSS: Scenario = [
  { phase: "intermission-pre", duration: 6, label: "Lobby" },
  { phase: "wolf-wait", duration: 18, label: "Waiting to spawn..." },
  { phase: "early", duration: 12, label: "Hunting" },
  { phase: "early-mid", duration: 20, label: "Mid game" },
  { phase: "mid", duration: 25, label: "No kills yet..." },
  { phase: "late-desperate", duration: 20, label: "Time running out!" },
  { phase: "round-end-wolves", duration: 8, label: "Wolves lose" },
  { phase: "intermission-between", duration: 8, label: "Between rounds" },
];

export const ALL_SCENARIOS: { name: string; scenario: Scenario; perspective: "sheep" | "wolf" }[] = [
  { name: "Sheep Win", scenario: SHEEP_WIN, perspective: "sheep" },
  { name: "Sheep Captured→Rescued", scenario: SHEEP_CAPTURED_RESCUED, perspective: "sheep" },
  { name: "Last Stand Win", scenario: SHEEP_LAST_STAND, perspective: "sheep" },
  { name: "Wolf Quick Win", scenario: WOLF_QUICK_WIN, perspective: "wolf" },
  { name: "Wolf Desperate Loss", scenario: WOLF_DESPERATE_LOSS, perspective: "wolf" },
];

// ── Simulator runner ──

export interface SimulatorState {
  scenario: Scenario;
  stepIndex: number;
  timer: number | null;
  prefadeTimer: number | null;
  running: boolean;
  /** Called when phase changes. */
  onPhaseChange: (phase: GamePhase, label: string, stepIndex: number, totalSteps: number) => void;
  /** Called to signal an upcoming phase change (for pre-fade). */
  onPreparePhase: (phase: GamePhase, secondsFromNow: number) => void;
  /** Called when scenario completes. */
  onComplete: () => void;
}

export function createSimulator(
  scenario: Scenario,
  onPhaseChange: SimulatorState["onPhaseChange"],
  onComplete: SimulatorState["onComplete"],
  onPreparePhase?: SimulatorState["onPreparePhase"],
): SimulatorState {
  return {
    scenario,
    stepIndex: -1,
    timer: null,
    prefadeTimer: null,
    running: false,
    onPhaseChange,
    onPreparePhase: onPreparePhase ?? (() => {}),
    onComplete,
  };
}

export function startSimulator(sim: SimulatorState): void {
  sim.running = true;
  sim.stepIndex = -1;
  advanceSimulator(sim);
}

export function stopSimulator(sim: SimulatorState): void {
  sim.running = false;
  if (sim.timer !== null) {
    clearTimeout(sim.timer);
    sim.timer = null;
  }
  if (sim.prefadeTimer !== null) {
    clearTimeout(sim.prefadeTimer);
    sim.prefadeTimer = null;
  }
}

/** How far ahead (seconds) to signal an upcoming phase change. */
const PREFADE_SIGNAL = 4;

function advanceSimulator(sim: SimulatorState): void {
  if (!sim.running) return;

  sim.stepIndex++;
  if (sim.stepIndex >= sim.scenario.length) {
    sim.running = false;
    sim.onComplete();
    return;
  }

  const step = sim.scenario[sim.stepIndex];
  sim.onPhaseChange(step.phase, step.label, sim.stepIndex, sim.scenario.length);

  // Schedule pre-fade for the NEXT step (if it exists and current step is long enough)
  const nextStep = sim.scenario[sim.stepIndex + 1];
  if (nextStep && step.duration > PREFADE_SIGNAL + 1) {
    const prefadeDelay = (step.duration - PREFADE_SIGNAL) * 1000;
    sim.prefadeTimer = setTimeout(() => {
      if (sim.running) {
        sim.onPreparePhase(nextStep.phase, PREFADE_SIGNAL);
      }
    }, prefadeDelay) as unknown as number;
  }

  sim.timer = setTimeout(() => {
    advanceSimulator(sim);
  }, step.duration * 1000) as unknown as number;
}
