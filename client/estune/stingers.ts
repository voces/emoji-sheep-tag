/**
 * Stinger system: short overlay cues fired on events without interrupting the bed.
 *
 * Stingers play through a separate renderer track (no crossfade with the bed).
 * Each stinger has its own gain (typically -3 to -6 dB relative to bed) so it
 * sits above the bed without trampling it.
 *
 * Stingers are key-neutral by convention (composed in C major / A minor or on
 * octave/fifth intervals) so they fit any underlying bed harmony.
 */

import { type Segment, type GameEvent, type Perspective } from "./types.ts";
import { noteOn } from "./sf2.ts";

export interface Stinger {
  id: string;
  /** Trigger label. Either a GameEvent type from the public API
   *  (capture/rescue/round-end/...) or an internal trigger string for
   *  engine-fired stingers like "round-start" (the bed bridge that fires
   *  on structural state transitions). Informational only — stingers
   *  fire when callers explicitly invoke fireStinger(). */
  trigger: GameEvent["type"] | string;
  /** Optional perspective filter (some events are perspective-specific). */
  perspective?: Perspective;
  /** Compiled segment containing the stinger material. */
  segment: Segment;
  /** Master gain in linear scale. Typical: 0.5-0.7. */
  gain: number;
}

/** Currently-playing stinger instance. */
export interface ActiveStinger {
  stinger: Stinger;
  /** Global beat at which the stinger started. */
  startBeat: number;
  /** Cursor per layer into its notes array. */
  cursors: number[];
  /** Stop callbacks for currently-sounding notes. */
  pendingStops: Map<string, { stopFn: () => void; endBeat: number }>;
  /** Channels assigned per layer. */
  channels: number[];
}

export interface StingerTrack {
  active: ActiveStinger[];
  /** Channels reserved for stinger use. */
  freeChannels: number[];
  /** Note callback for piano-roll visualization. */
  onNote?: (id: string, midi: number, velocity: number, beat: number, duration: number) => void;
}

const STINGER_CHANNELS = [12, 13, 14, 15];

export function createStingerTrack(): StingerTrack {
  return {
    active: [],
    freeChannels: [...STINGER_CHANNELS],
  };
}

/** Fire a stinger at the next bar boundary (or specified beat). */
export function fireStinger(
  track: StingerTrack,
  stinger: Stinger,
  startBeat: number,
): void {
  // Allocate a channel per layer
  const channels: number[] = [];
  for (let i = 0; i < stinger.segment.layers.length; i++) {
    const ch = track.freeChannels.pop() ?? STINGER_CHANNELS[i % STINGER_CHANNELS.length];
    channels.push(ch);
  }
  track.active.push({
    stinger,
    startBeat,
    cursors: stinger.segment.layers.map(() => 0),
    pendingStops: new Map(),
    channels,
  });
}

/** Tick the stinger track. Schedules notes within the lookahead window
 *  and processes note-offs whose duration has elapsed. */
export function stingerTick(
  track: StingerTrack,
  currentBeat: number,
  lookaheadBeats: number,
): void {
  const completed: ActiveStinger[] = [];

  for (const inst of track.active) {
    const { stinger, startBeat, cursors, pendingStops, channels } = inst;

    // Stop notes that have ended
    for (const [key, p] of pendingStops) {
      if (p.endBeat <= currentBeat) {
        p.stopFn();
        pendingStops.delete(key);
      }
    }

    let allDone = true;
    for (let li = 0; li < stinger.segment.layers.length; li++) {
      const layer = stinger.segment.layers[li];
      while (cursors[li] < layer.notes.length) {
        const note = layer.notes[cursors[li]];
        const noteBeat = startBeat + note.beat;
        if (noteBeat > currentBeat + lookaheadBeats) {
          allDone = false;
          break;
        }
        if (noteBeat >= currentBeat - 0.01) {
          const velocity = (note.velocity ?? 0.7) * stinger.gain;
          const stopFn = noteOn(note.midi, layer.instrument, velocity, channels[li]);
          const endBeat = noteBeat + note.duration;
          pendingStops.set(`${channels[li]}:${note.midi}:${cursors[li]}`,
            { stopFn, endBeat });
          track.onNote?.(stinger.id, note.midi, velocity, noteBeat, note.duration);
        }
        cursors[li]++;
      }
      if (cursors[li] < layer.notes.length) allDone = false;
    }

    // Stinger is done when all layers are exhausted and no pending stops remain
    if (allDone && pendingStops.size === 0) {
      completed.push(inst);
    }
  }

  // Reap completed instances and return their channels to the pool
  for (const inst of completed) {
    for (const ch of inst.channels) {
      if (!track.freeChannels.includes(ch)) track.freeChannels.push(ch);
    }
    const idx = track.active.indexOf(inst);
    if (idx >= 0) track.active.splice(idx, 1);
  }
}

/** Stop all active stingers immediately. */
export function stopAllStingers(track: StingerTrack): void {
  for (const inst of track.active) {
    for (const p of inst.pendingStops.values()) p.stopFn();
    for (const ch of inst.channels) {
      if (!track.freeChannels.includes(ch)) track.freeChannels.push(ch);
    }
  }
  track.active = [];
}
