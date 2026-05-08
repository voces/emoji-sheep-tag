/**
 * Beat clock with Web Audio lookahead scheduling.
 * No setTimeout for musical timing — uses AudioContext.currentTime
 * with a lookahead buffer for sample-accurate note placement.
 */

export interface ClockState {
  playing: boolean;
  tempo: number;
  beat: number;
  onBeat: (beat: number, audioTime: number) => void;
}

const LOOKAHEAD_MS = 100;
const CHECK_INTERVAL = 25;

let intervalId: number | null = null;
let nextBeatTime = 0;

/** Start (or resume) the clock from the current beat position. */
export function startClock(ctx: AudioContext, state: ClockState): void {
  // Clear any existing interval
  if (intervalId !== null) {
    globalThis.clearInterval(intervalId);
    intervalId = null;
  }

  state.playing = true;
  // Always schedule from NOW, not from some past time
  nextBeatTime = ctx.currentTime + 0.05;

  intervalId = globalThis.setInterval(() => {
    if (!state.playing) return;

    const secondsPerBeat = 60 / state.tempo;
    const lookAhead = LOOKAHEAD_MS / 1000;

    while (nextBeatTime < ctx.currentTime + lookAhead) {
      state.onBeat(state.beat, nextBeatTime);
      state.beat++;
      nextBeatTime += secondsPerBeat;
    }
  }, CHECK_INTERVAL);
}

/** Stop the clock. Beat position is preserved for resume. */
export function stopClock(state: ClockState): void {
  state.playing = false;
  if (intervalId !== null) {
    globalThis.clearInterval(intervalId);
    intervalId = null;
  }
}

/** Create a fresh clock state. */
export function createClock(
  tempo: number,
  onBeat: (beat: number, audioTime: number) => void,
): ClockState {
  return { playing: false, tempo, beat: 0, onBeat };
}
