/**
 * Compiler: authoring text format → Segment JSON.
 *
 * Authoring format:
 *
 *   === segment-id ===
 *   family: intermission
 *   key: G major
 *   tempo: 100
 *   meter: 4/4
 *   bars: 8
 *   tags: pastoral, sheep, calm
 *   transitions: bar 4 half-cadence G D Em, bar 8 full-cadence G C Am
 *
 *   [melody] flute(73) priority=2
 *   | G4:2 A4:1 B4:1 | C5:3 B4:1 |
 *
 *   [bass] cello(42) priority=0
 *   | G2:2 D3:2 | C3:4 |
 *
 * Note format: NoteName[#/b]Octave:Duration  (e.g. F#4:1.5, Bb3:0.5)
 * Rest: r:Duration
 * Chord: [G3,B3,D4]:Duration  (expands to multiple NoteEvents at same beat)
 */

import {
  type Segment, type Layer, type NoteEvent, type Key, type SegmentTag,
  type TransitionHint, type LayerRole, type Articulation,
  type BleedSpec, type BleedSource,
} from "./types.ts";

// ── Dynamics & Articulation ──

const DYNAMICS: Record<string, number> = {
  "pp": 0.25, "p": 0.4, "mp": 0.55, "mf": 0.7, "f": 0.85, "ff": 1.0,
};

const ARTICULATION_PREFIXES: Record<string, Articulation> = {
  ">": "accent", ".": "staccato", "~": "tenuto",
};

interface NoteContext {
  velocity: number | undefined; // current sticky dynamic (undefined = use role default)
}

/** Strip dynamics and articulation prefixes from a token.
 *  Dynamics are sticky (update ctx). Articulations are per-note.
 *  Order: dynamics first, then articulations, so "ff>C4:1" works. */
function parseModifiers(token: string, ctx: NoteContext): { cleaned: string; articulation?: Articulation } {
  let articulation: Articulation | undefined;

  // Dynamics prefix (pp, p, mp, mf, f, ff) — check longest first to avoid "f" matching "ff"
  for (const dyn of ["pp", "mp", "mf", "ff", "p", "f"]) {
    if (token.startsWith(dyn) && token.length > dyn.length) {
      const rest = token.slice(dyn.length);
      // What follows must be a note char, articulation prefix, or chord bracket
      if (/^[A-Gr\[>.~]/.test(rest)) {
        ctx.velocity = DYNAMICS[dyn];
        token = rest;
        break;
      }
    }
  }

  // Single-char articulation prefixes: > . ~
  while (token.length > 0 && token[0] in ARTICULATION_PREFIXES) {
    articulation = ARTICULATION_PREFIXES[token[0]];
    token = token.slice(1);
  }

  return { cleaned: token, articulation };
}

// ── Note name → MIDI ──

const NOTE_MAP: Record<string, number> = {
  "C": 0, "C#": 1, "Db": 1,
  "D": 2, "D#": 3, "Eb": 3,
  "E": 4,
  "F": 5, "F#": 6, "Gb": 6,
  "G": 7, "G#": 8, "Ab": 8,
  "A": 9, "A#": 10, "Bb": 10,
  "B": 11,
};

/** Parse "C#4" or "Bb3" → MIDI number. */
export function noteNameToMidi(name: string): number {
  const match = name.match(/^([A-G][#b]?)(-?\d+)$/);
  if (!match) throw new Error(`Invalid note name: "${name}"`);
  const [, notePart, octStr] = match;
  const semitone = NOTE_MAP[notePart];
  if (semitone === undefined) throw new Error(`Unknown note: "${notePart}"`);
  const octave = parseInt(octStr, 10);
  return (octave + 1) * 12 + semitone; // C4 = 60
}

/** Parse "G major" or "E minor" → Key. */
function parseKey(s: string): Key {
  const parts = s.trim().split(/\s+/);
  if (parts.length < 2) throw new Error(`Invalid key: "${s}"`);
  return { root: parts[0], mode: parts.slice(1).join(" ") };
}

/** Parse "4/4" → [4, 4]. */
function parseMeter(s: string): [number, number] {
  const parts = s.trim().split("/");
  if (parts.length !== 2) throw new Error(`Invalid meter: "${s}"`);
  return [parseInt(parts[0], 10), parseInt(parts[1], 10)];
}

/** Parse a single note token like "G4:2", "r:1.5", "mfG4:2", ">A4:1", or "[G3,B3,D4]:4".
 *  Dynamics (pp/p/mp/mf/f/ff) are sticky — they update ctx and persist.
 *  Articulations (> . ~ legato) are per-note. */
function parseNoteToken(
  token: string, currentBeat: number, ctx: NoteContext,
): { notes: NoteEvent[]; advance: number } {
  token = token.trim();
  if (!token) return { notes: [], advance: 0 };

  // Handle "legato" as a standalone token → applies to next note parsed elsewhere
  // (it's consumed at the token-split level in parseNoteLines)

  // Strip modifiers
  const { cleaned, articulation } = parseModifiers(token, ctx);
  token = cleaned;

  // Rest
  if (token.startsWith("r:")) {
    const dur = parseFloat(token.slice(2));
    if (isNaN(dur) || dur <= 0) throw new Error(`Invalid rest duration: "${token}"`);
    return { notes: [], advance: dur };
  }

  // Build note properties
  const noteProps: Partial<NoteEvent> = {};
  if (ctx.velocity !== undefined) noteProps.velocity = ctx.velocity;
  if (articulation) noteProps.articulation = articulation;

  // Chord: [G3,B3,D4]:4
  if (token.startsWith("[")) {
    const bracketEnd = token.indexOf("]");
    if (bracketEnd === -1) throw new Error(`Unclosed bracket in: "${token}"`);
    const pitchPart = token.slice(1, bracketEnd);
    const durPart = token.slice(bracketEnd + 1);
    if (!durPart.startsWith(":")) throw new Error(`Missing duration after chord: "${token}"`);
    const dur = parseFloat(durPart.slice(1));
    if (isNaN(dur) || dur <= 0) throw new Error(`Invalid chord duration: "${token}"`);

    const pitchNames = pitchPart.split(",").map(s => s.trim());
    const notes: NoteEvent[] = pitchNames.map(name => ({
      beat: currentBeat,
      midi: noteNameToMidi(name),
      duration: dur,
      ...noteProps,
    }));
    return { notes, advance: dur };
  }

  // Single note: G4:2, F#4:1.5
  const colonIdx = token.indexOf(":");
  if (colonIdx === -1) throw new Error(`Missing duration (need ":") in: "${token}"`);
  const pitchStr = token.slice(0, colonIdx);
  const dur = parseFloat(token.slice(colonIdx + 1));
  if (isNaN(dur) || dur <= 0) throw new Error(`Invalid duration in: "${token}"`);

  return {
    notes: [{ beat: currentBeat, midi: noteNameToMidi(pitchStr), duration: dur, ...noteProps }],
    advance: dur,
  };
}

// ── Layer parsing ──

/** Parse "[melody] flute(73) priority=2" → layer header info.
 *  Supports optional palette-bleed flag:
 *    `[perc] timpani(47) priority=1 bleed`
 *    `[perc] timpani(47) priority=1 bleed bleedFloor=0.4`
 *    `[sparkle] celesta(8) priority=1 bleed bleedSource=inverse-tension`
 *  Defaults: bleedSource=tension, bleedFloor=0. */
function parseLayerHeader(line: string): {
  id: string; role: LayerRole; instrument: number; priority: number; bleed?: BleedSpec; norotate?: boolean;
} {
  const roleMatch = line.match(/^\[(\w+)\]/);
  if (!roleMatch) throw new Error(`Invalid layer header: "${line}"`);
  const role = roleMatch[1] as LayerRole;

  const progMatch = line.match(/\w+\((\d+)\)/);
  const instrument = progMatch ? parseInt(progMatch[1], 10) : 0;

  const prioMatch = line.match(/priority=(\d+)/);
  const priority = prioMatch ? parseInt(prioMatch[1], 10) : 1;

  // `bleed` as a standalone word — careful not to match `bleedSource`/`bleedFloor`.
  let bleed: BleedSpec | undefined;
  if (/(?:^|\s)bleed(?:\s|$)/.test(line)) {
    const sourceMatch = line.match(/bleedSource=([\w-]+)/);
    const rawSource = sourceMatch?.[1] ?? "tension";
    const validSources: readonly string[] = [
      "tension", "inverse-tension",
      "daylight", "darkness",
      "round-final", "round-countdown",
    ];
    if (!validSources.includes(rawSource)) {
      throw new Error(
        `Invalid bleedSource "${rawSource}" — use one of ${validSources.join(", ")}`,
      );
    }
    const source = rawSource as BleedSource;
    const floorMatch = line.match(/bleedFloor=([\d.]+)/);
    const floor = floorMatch ? parseFloat(floorMatch[1]) : 0;
    if (isNaN(floor) || floor < 0 || floor > 1) {
      throw new Error(`bleedFloor must be in [0, 1], got "${floorMatch?.[1]}"`);
    }
    bleed = { source, floor };
  }

  const norotate = /(?:^|\s)norotate(?:\s|$)/.test(line);

  return { id: role, role, instrument, priority, bleed, norotate };
}

/** Parse note lines (everything between layer headers) into NoteEvents.
 *  Validates that total beats per bar match expected beatsPerBar. Returns
 *  the parsed notes alongside the authored extent in beats — needed by the
 *  renderer's tileLayerToSegment to distinguish a sparse 12-bar layer
 *  (e.g. one ff stab on bar 1, rests on bars 2-12) from a 1-bar pattern
 *  the engine should tile. Without this, lastNote.beat + duration is the
 *  only signal, and the renderer mistakes the sparse layer for a 1-bar
 *  loop and tiles the stab onto every bar. */
function parseNoteLines(lines: string[], beatsPerBar: number, segId: string, layerId: string): { notes: NoteEvent[]; authoredBeats: number } {
  const joined = lines.join(" ");
  const barTexts = joined.split("|").map(s => s.trim()).filter(s => s.length > 0);

  const allNotes: NoteEvent[] = [];
  let globalBeat = 0;
  const ctx: NoteContext = { velocity: undefined };
  let pendingArticulation: Articulation | undefined;

  for (let barIdx = 0; barIdx < barTexts.length; barIdx++) {
    const barStart = globalBeat;
    const tokens = barTexts[barIdx].split(/\s+/).filter(s => s.length > 0);

    for (const tok of tokens) {
      // Handle standalone dynamics (e.g., "mf" or "pp" as separate tokens)
      if (tok in DYNAMICS) {
        ctx.velocity = DYNAMICS[tok];
        continue;
      }
      // Handle standalone articulation keywords
      if (tok === "legato" || tok === "staccato" || tok === "accent" || tok === "tenuto") {
        pendingArticulation = tok as Articulation;
        continue;
      }

      const { notes, advance } = parseNoteToken(tok, globalBeat, ctx);

      // Apply pending standalone articulation
      if (pendingArticulation && notes.length > 0) {
        for (const n of notes) {
          if (!n.articulation) n.articulation = pendingArticulation;
        }
        pendingArticulation = undefined;
      }

      allNotes.push(...notes);
      globalBeat += advance;
    }

    const barBeats = globalBeat - barStart;
    const tolerance = 0.001;
    if (Math.abs(barBeats - beatsPerBar) > tolerance) {
      throw new Error(
        `${segId}/${layerId} bar ${barIdx + 1}: expected ${beatsPerBar} beats, got ${barBeats}`
      );
    }
  }

  return { notes: allNotes, authoredBeats: globalBeat };
}

// ── Transition parsing ──

/** Parse "bar 4 half-cadence G D Em, bar 8 full-cadence G C Am" */
function parseTransitions(s: string): TransitionHint[] {
  if (!s.trim()) return [];
  return s.split(",").map(part => {
    part = part.trim();
    const match = part.match(/^bar\s+(\d+)\s+([\w-]+)\s+(.+)$/);
    if (!match) throw new Error(`Invalid transition: "${part}"`);
    const bar = parseInt(match[1], 10);
    const type = match[2] as TransitionHint["type"];
    const keys = match[3].split(/\s+/).map(k => {
      // Simple key names: "G" = G major, "Em" = E minor, "Dm" = D minor
      if (k.endsWith("m")) return { root: k.slice(0, -1), mode: "minor" };
      return { root: k, mode: "major" };
    });
    return { bar, type, compatibleKeys: keys };
  });
}

// ── Top-level compiler ──

/** Compile a single segment from authoring text. */
export function compileSegment(text: string): Segment {
  const lines = text.split("\n");
  let idx = 0;

  // Skip blank lines to find header
  while (idx < lines.length && !lines[idx].trim().startsWith("===")) idx++;
  if (idx >= lines.length) throw new Error("No segment header (=== id ===) found");

  // Parse header
  const headerMatch = lines[idx].trim().match(/^===\s+(.+?)\s+===$/);
  if (!headerMatch) throw new Error(`Invalid header: "${lines[idx]}"`);
  const id = headerMatch[1];
  idx++;

  // Parse metadata key: value lines.
  // Skip blank and `#` comment lines.
  const meta: Record<string, string> = {};
  while (idx < lines.length) {
    const line = lines[idx].trim();
    if (!line || line.startsWith("#")) { idx++; continue; }
    if (line.startsWith("[")) break; // layer start
    const colonPos = line.indexOf(":");
    if (colonPos === -1) break;
    const key = line.slice(0, colonPos).trim();
    const val = line.slice(colonPos + 1).trim();
    meta[key] = val;
    idx++;
  }

  // Validate required metadata
  for (const req of ["family", "key", "tempo", "meter", "bars"]) {
    if (!meta[req]) throw new Error(`${id}: missing required field "${req}"`);
  }

  const key = parseKey(meta["key"]);
  const tempo = parseFloat(meta["tempo"]);
  const meter = parseMeter(meta["meter"]);
  const bars = parseInt(meta["bars"], 10);
  const beatsPerBar = meter[0]; // e.g. 4 for 4/4, 3 for 3/4, 6 for 6/8
  const totalBeats = bars * beatsPerBar;
  const tags = (meta["tags"] ?? "").split(",").map(s => s.trim()).filter(s => s) as SegmentTag[];
  const transitions = parseTransitions(meta["transitions"] ?? "");
  const family = meta["family"];
  const breath = parseBreath(meta["breath"], id, bars);
  // Song-set tag for round-coherent variant selection. Authors declare
  // `song: A` (or B / C / etc.) on alternate seg files; the canonical
  // bed (no `song:` header) is the "base" song. Per round the director
  // picks one song and prefers matching variants across all beds.
  const song = (meta["song"] ?? "base").trim() || "base";

  // Parse layers
  const layers: Layer[] = [];
  while (idx < lines.length) {
    const line = lines[idx].trim();
    if (!line || line.startsWith("#")) { idx++; continue; }

    // New layer header
    if (line.startsWith("[")) {
      const header = parseLayerHeader(line);
      idx++;

      // Collect note lines until next layer header, next segment, or EOF.
      // Skip blank and `#` comment lines so authors can annotate between
      // layers without breaking parsing.
      const noteLines: string[] = [];
      while (idx < lines.length) {
        const nl = lines[idx].trim();
        if (nl.startsWith("[") || nl.startsWith("===")) break;
        if (nl && !nl.startsWith("#")) noteLines.push(nl);
        idx++;
      }

      const { notes, authoredBeats } = parseNoteLines(noteLines, beatsPerBar, id, header.id);
      layers.push({ ...header, notes, authoredBeats });
    } else {
      idx++;
    }
  }

  // Validate layer bar counts
  for (const layer of layers) {
    if (layer.notes.length === 0) continue;
    const lastNote = layer.notes[layer.notes.length - 1];
    const lastBeat = lastNote.beat + lastNote.duration;
    if (lastBeat > totalBeats + 0.001) {
      throw new Error(
        `${id}/${layer.id}: notes extend past segment end (${lastBeat} > ${totalBeats})`
      );
    }
  }

  // Validate transitions reference valid bars
  for (const t of transitions) {
    if (t.bar > bars) {
      throw new Error(`${id}: transition at bar ${t.bar} exceeds segment length ${bars}`);
    }
  }

  return { id, key, tempo, meter, bars, totalBeats, layers, tags, transitions, family, breath, song };
}

/** Parse `breath: after=N every=M hold=K layers=a,b` header. Returns
 *  undefined if the header is absent. Throws on malformed input rather
 *  than silently dropping a misspelled field — breath config is opt-in
 *  so authors who write it expect it to take effect. */
function parseBreath(s: string | undefined, segId: string, totalBars: number) {
  if (!s) return undefined;
  const fields: Record<string, string> = {};
  for (const tok of s.split(/\s+/).filter(t => t)) {
    const eq = tok.indexOf("=");
    if (eq === -1) {
      throw new Error(`${segId}: breath token "${tok}" missing '=' (expected key=value)`);
    }
    fields[tok.slice(0, eq).trim()] = tok.slice(eq + 1).trim();
  }
  const known = new Set(["after", "every", "hold", "layers"]);
  for (const k of Object.keys(fields)) {
    if (!known.has(k)) {
      throw new Error(`${segId}: unknown breath field "${k}" (expected after/every/hold/layers)`);
    }
  }
  if (!fields["layers"]) {
    throw new Error(`${segId}: breath requires layers=<id1,id2,...>`);
  }
  const layerIds = fields["layers"].split(",").map(s => s.trim()).filter(s => s);
  if (layerIds.length === 0) {
    throw new Error(`${segId}: breath layers list is empty`);
  }
  // Defaults: don't breathe until one full loop has played, then a cycle
  // every loop with the in-breath occupying ~1/4 of the loop. These are
  // sensible starting points; any bed can override.
  const after = fields["after"] ? parseInt(fields["after"], 10) : totalBars;
  const every = fields["every"] ? parseInt(fields["every"], 10) : totalBars;
  const hold = fields["hold"] ? parseInt(fields["hold"], 10) : Math.max(1, Math.floor(every / 4));
  if (!(every > 0)) throw new Error(`${segId}: breath every must be > 0 (got ${every})`);
  if (!(hold > 0)) throw new Error(`${segId}: breath hold must be > 0 (got ${hold})`);
  if (hold >= every) {
    throw new Error(
      `${segId}: breath hold (${hold}) must be less than every (${every}) — otherwise the layer would never play`
    );
  }
  if (after < 0) throw new Error(`${segId}: breath after must be >= 0 (got ${after})`);
  return { after, every, hold, layers: layerIds };
}

/** Compile multiple segments from a single file (segments separated by === headers). */
export function compileFile(text: string): Segment[] {
  // Split on segment headers, keeping the header with its content
  const parts = text.split(/(?=^===\s)/m).filter(s => s.trim());
  return parts.map(compileSegment);
}
