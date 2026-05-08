/**
 * Hook slot pre-processor: expand %HOOK_*% markers in segment text to literal
 * note tokens before passing to compileSegment().
 *
 * Slot syntax:
 *   %HOOK_MAJOR_OCT4%   — hook in major mode anchored at root octave 4
 *   %HOOK_MINOR_OCT4%   — hook in (parallel) minor mode
 *   %HOOK_GHOST_OCT5%   — sparse, low-velocity fragments
 *
 * Octave is the octave of the tonic ("1" degree). For G major, OCT4 means G4.
 *
 * Mode is determined by the slot itself (MAJOR/MINOR/GHOST) regardless of the
 * segment's declared key — this lets a single segment include both the major
 * statement and minor shadow if needed.
 */

import { type Hook, type Key, type NoteEvent } from "./types.ts";
import { type HookSpec, resolveHook, resolveHookGhost } from "./hooks.ts";

const SLOT_PATTERN = /%HOOK_(MAJOR|MINOR|GHOST)_OCT(-?\d+)%/g;

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToToken(midi: number, durationBeats: number, velocity?: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[pc];
  // Use sharps in token output; the compiler accepts both # and b.
  const dynStr = velocity !== undefined && velocity < 0.35 ? "pp " : "";
  return `${dynStr}${name}${octave}:${durationBeats}`;
}

/** Format a sequence of note events as compiler tokens, inserting bar separators. */
function notesToBarredTokens(notes: NoteEvent[], beatsPerBar: number, totalBeats: number): string {
  const tokens: string[] = [];
  let nextBarBoundary = beatsPerBar;
  let lastBeat = 0;

  for (const n of notes) {
    // Emit any leading rest from the previous note's end to this note's start
    if (n.beat > lastBeat) {
      const restDur = n.beat - lastBeat;
      // If rest crosses a bar boundary, split
      let remaining = restDur;
      let cursor = lastBeat;
      while (remaining > 0) {
        const distanceToBar = nextBarBoundary - cursor;
        if (distanceToBar <= 0.0001) {
          tokens.push("|");
          nextBarBoundary += beatsPerBar;
          continue;
        }
        const take = Math.min(remaining, distanceToBar);
        tokens.push(`r:${take}`);
        cursor += take;
        remaining -= take;
        if (Math.abs(cursor - nextBarBoundary) < 0.0001 && remaining > 0) {
          tokens.push("|");
          nextBarBoundary += beatsPerBar;
        }
      }
      lastBeat = n.beat;
    }

    // If this note starts at the bar boundary, emit a bar line first
    if (Math.abs(n.beat - nextBarBoundary) < 0.0001 && tokens.length > 0) {
      tokens.push("|");
      nextBarBoundary += beatsPerBar;
    }

    tokens.push(midiToToken(n.midi, n.duration, n.velocity));
    lastBeat = n.beat + n.duration;

    // Emit bar separator if we've reached one
    if (Math.abs(lastBeat - nextBarBoundary) < 0.0001) {
      tokens.push("|");
      nextBarBoundary += beatsPerBar;
    }
  }

  // Trailing rest to fill out the hook's declared bars
  if (lastBeat < totalBeats) {
    let remaining = totalBeats - lastBeat;
    let cursor = lastBeat;
    while (remaining > 0) {
      const distanceToBar = nextBarBoundary - cursor;
      const take = Math.min(remaining, distanceToBar);
      tokens.push(`r:${take}`);
      cursor += take;
      remaining -= take;
      if (Math.abs(cursor - nextBarBoundary) < 0.0001 && remaining > 0) {
        tokens.push("|");
        nextBarBoundary += beatsPerBar;
      }
    }
  }

  return tokens.join(" ");
}

/** Expand all %HOOK_*% slots in segment text against the given hook spec.
 *
 *  Each slot expands to bar-separated tokens. The author wraps adjacent bars:
 *      | %HOOK_MAJOR_OCT4% | next-bar-tokens |
 *  The expansion replaces the marker with: tokens + " | " + tokens (etc).
 */
export function expandHookSlots(
  text: string,
  hook: HookSpec,
  rootName: string,
  beatsPerBar: number,
): string {
  return text.replace(SLOT_PATTERN, (_match, modeTag: string, octStr: string) => {
    const octave = parseInt(octStr, 10);
    const mode = modeTag === "MAJOR" ? "major" : "minor";
    const key: Key = { root: rootName, mode };
    // pitch class of root
    const rootPc = NOTE_PC[rootName];
    if (rootPc === undefined) throw new Error(`Bad root in hook slot: ${rootName}`);
    const rootMidi = (octave + 1) * 12 + rootPc;

    const notes = modeTag === "GHOST"
      ? resolveHookGhost(hook, key, rootMidi, 0)
      : resolveHook(hook, key, rootMidi, 0);

    const totalBeats = hook.bars * beatsPerBar;
    return notesToBarredTokens(notes, beatsPerBar, totalBeats);
  });
}

const NOTE_PC: Record<string, number> = {
  "C": 0, "C#": 1, "Db": 1,
  "D": 2, "D#": 3, "Eb": 3,
  "E": 4,
  "F": 5, "F#": 6, "Gb": 6,
  "G": 7, "G#": 8, "Ab": 8,
  "A": 9, "A#": 10, "Bb": 10,
  "B": 11,
};
