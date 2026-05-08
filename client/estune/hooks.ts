/**
 * Hook compiler: scale-degree notation → concrete NoteEvents in a target key.
 *
 * A hook is per-round leitmotif material that gets plugged into bed templates
 * via slots like %HOOK_MAJOR%, %HOOK_MINOR%, %HOOK_GHOST%.
 *
 * Authoring format (.hook file):
 *
 *   === hook-id ===
 *   character: lyrical
 *   bars: 2
 *   1:1 2:1 3:0.5 4:0.5 5:1
 *   6:3 5:1
 *
 * Lines starting with `#` are comments; blank lines ignored.
 * Each non-metadata line is one bar of scale-degree tokens.
 *
 * Token: [octave-prefix]degree:duration
 *   degree: 1-7
 *   octave-prefix: ^ (up an octave), , (down an octave); repeatable (^^, ,,)
 *   duration: float in beats (default 1)
 * Rest: r:duration
 */

import { type Hook, type NoteEvent, type Key } from "./types.ts";

export interface HookSpec {
  id: string;
  character: Hook["character"];
  bars: number;
  /** Scale-degree tokens grouped by bar. */
  bars_data: HookToken[][];
}

interface HookToken {
  /** 1-7, or null for rest. */
  degree: number | null;
  /** Octave shift relative to root: 0, +1, -1, ... */
  octaveShift: number;
  durationBeats: number;
}

/** Parse a single token like "1:1" or "^3:0.5" or ",,5:2" or "r:1". */
function parseToken(token: string): HookToken {
  if (token.startsWith("r:")) {
    const dur = parseFloat(token.slice(2));
    if (isNaN(dur) || dur <= 0) throw new Error(`Bad rest: "${token}"`);
    return { degree: null, octaveShift: 0, durationBeats: dur };
  }

  let octaveShift = 0;
  let i = 0;
  while (i < token.length && (token[i] === "^" || token[i] === ",")) {
    octaveShift += token[i] === "^" ? 1 : -1;
    i++;
  }

  const colon = token.indexOf(":", i);
  if (colon === -1) throw new Error(`Hook token missing duration: "${token}"`);
  const degreeStr = token.slice(i, colon);
  const durStr = token.slice(colon + 1);
  const degree = parseInt(degreeStr, 10);
  if (!(degree >= 1 && degree <= 7)) {
    throw new Error(`Hook degree must be 1-7, got "${degreeStr}" in "${token}"`);
  }
  const durationBeats = parseFloat(durStr);
  if (isNaN(durationBeats) || durationBeats <= 0) {
    throw new Error(`Bad duration in "${token}"`);
  }
  return { degree, octaveShift, durationBeats };
}

/** Parse a .hook file into a HookSpec. */
export function parseHookFile(text: string): HookSpec {
  const lines = text.split("\n");
  let id = "";
  let character: Hook["character"] = "lyrical";
  let bars = 0;
  const barData: HookToken[][] = [];

  let inBody = false;
  for (let raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    if (line.startsWith("===")) {
      const m = line.match(/^===\s+(.+?)\s+===$/);
      if (!m) throw new Error(`Bad header: "${line}"`);
      id = m[1];
      inBody = true;
      continue;
    }
    if (!inBody) continue;
    if (line.includes(":") && !/^\^|^,|^[0-9r]/.test(line)) {
      // metadata line "key: value"
      const colon = line.indexOf(":");
      const k = line.slice(0, colon).trim();
      const v = line.slice(colon + 1).trim();
      if (k === "character") character = v as Hook["character"];
      else if (k === "bars") bars = parseInt(v, 10);
      continue;
    }
    // bar of tokens
    const tokens = line.split(/\s+/).filter(s => s.length > 0).map(parseToken);
    barData.push(tokens);
  }

  if (!id) throw new Error("Hook file missing === id === header");
  if (bars > 0 && barData.length !== bars) {
    throw new Error(`Hook ${id}: declared ${bars} bars but found ${barData.length}`);
  }

  return { id, character, bars: bars || barData.length, bars_data: barData };
}

// ── Mode interval tables ──
// Semitone offsets from tonic for each scale degree 1-7.

const MODE_INTERVALS: Record<string, number[]> = {
  "major": [0, 2, 4, 5, 7, 9, 11],
  "minor": [0, 2, 3, 5, 7, 8, 10],          // natural minor
  "dorian": [0, 2, 3, 5, 7, 9, 10],
  "mixolydian": [0, 2, 4, 5, 7, 9, 10],
};

const ROOT_PC: Record<string, number> = {
  "C": 0, "C#": 1, "Db": 1,
  "D": 2, "D#": 3, "Eb": 3,
  "E": 4,
  "F": 5, "F#": 6, "Gb": 6,
  "G": 7, "G#": 8, "Ab": 8,
  "A": 9, "A#": 10, "Bb": 10,
  "B": 11,
};

/**
 * Resolve a hook into concrete MIDI notes for a target key, starting at a
 * given beat with notes anchored to a target octave (root MIDI value of the
 * "1" degree at octave 0 of the spec).
 */
export function resolveHook(
  spec: HookSpec,
  targetKey: Key,
  rootMidi: number,
  startBeat: number,
  options?: { ghost?: boolean },
): NoteEvent[] {
  const intervals = MODE_INTERVALS[targetKey.mode];
  if (!intervals) throw new Error(`Unsupported mode: ${targetKey.mode}`);

  const rootPc = ROOT_PC[targetKey.root];
  if (rootPc === undefined) throw new Error(`Unknown root: ${targetKey.root}`);

  // Sanity-check rootMidi pitch class matches the key root.
  if ((rootMidi % 12 + 12) % 12 !== rootPc) {
    throw new Error(
      `rootMidi ${rootMidi} (pc ${rootMidi % 12}) doesn't match key root ${targetKey.root} (pc ${rootPc})`,
    );
  }

  const notes: NoteEvent[] = [];
  let beat = startBeat;

  for (const bar of spec.bars_data) {
    for (const tok of bar) {
      if (tok.degree === null) {
        beat += tok.durationBeats;
        continue;
      }
      const semitone = intervals[tok.degree - 1] + 12 * tok.octaveShift;
      const midi = rootMidi + semitone;
      const note: NoteEvent = {
        beat,
        midi,
        duration: tok.durationBeats,
      };
      // Ghost mode: lower velocity, longer rests between notes (musically: every other note)
      if (options?.ghost) {
        note.velocity = 0.25;
      }
      notes.push(note);
      beat += tok.durationBeats;
    }
  }

  return notes;
}

/** Resolve as fragmented "ghost" — only first note + last note, others become rests. */
export function resolveHookGhost(
  spec: HookSpec, targetKey: Key, rootMidi: number, startBeat: number,
): NoteEvent[] {
  const full = resolveHook(spec, targetKey, rootMidi, startBeat);
  if (full.length === 0) return [];
  // Keep first and last, drop others. Set velocity to ghostly.
  const first = { ...full[0], velocity: 0.25 };
  const last = full.length > 1 ? { ...full[full.length - 1], velocity: 0.25 } : null;
  return last ? [first, last] : [first];
}

/** Build a Hook (the runtime structure) from a HookSpec resolved in a target key. */
export function buildHook(spec: HookSpec, key: Key, rootMidi: number): Hook {
  return {
    id: spec.id,
    character: spec.character,
    notes: resolveHook(spec, key, rootMidi, 0),
  };
}
