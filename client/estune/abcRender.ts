/**
 * Headless ABC renderer: walks a generated FacetScenario, picks the active
 * bed at each waypoint, and emits a single masked ABC file matching the
 * blind-evaluation format-parity rules (docs/evaluation/methodology.md).
 *
 * Format parity:
 *   - Title is generic (Song-XX)
 *   - Voice names are register-descriptive (High/Mid/Low Part N)
 *   - No `%%MIDI program` directives
 *   - Inline [K:] and [Q:] directives at bed boundaries
 *   - No comments, no instrument names
 *   - Dynamics present (!mp!, !mf!, !f!, etc.)
 *
 * The rendering is sequential and deterministic: each waypoint pair becomes
 * one bed-block with its own key/tempo header. Bed crossfades and modulation
 * are NOT rendered — this is a single-bed-per-section render, which is the
 * cleanest representation for blind evaluation.
 */

import { generateScenario, type RoundTemplate } from "./roundTemplates.ts";
import { selectSheepBedWithBlend, selectWolfBedWithBlend } from "./beds.ts";
import { type BedLibrary } from "./bedLibrary.ts";
import {
  type FullGameState, type Segment, type Layer, type NoteEvent, type BedId,
  type SheepFacets, type WolfFacets, type StructuralState, type Perspective,
} from "./types.ts";

const DEFAULT_SHEEP: SheepFacets = {
  alive: true, threat: 0, agency: 0, isolation: 0,
  lastAlive: false, roundProgress: 0,
};
const DEFAULT_WOLF: WolfFacets = {
  proximity: 0, agency: 0, isolation: 0, roundProgress: 0,
};

interface BedBlock {
  bed: Segment;
  bars: number;
  label?: string;
}

/** Pick which bed the engine would play at the given waypoint state. */
function pickBed(state: FullGameState, lib: BedLibrary): Segment | null {
  let id: string;
  if (state.state === "lobby") id = "lobby";
  else if (state.state === "build") {
    const persp = state.perspective === "wolf" ? "wolf" : "sheep";
    const m = state.mode ?? "survival";
    const modeKey = m === "bulldog" ? "bulldog" : m === "switch" ? "switch" : "survival";
    id = `build-${persp}-${modeKey}`;
  }
  else if (state.perspective === "wolf" && state.wolf) {
    id = selectWolfBedWithBlend(state.wolf).primary;
  } else if (state.sheep) {
    id = selectSheepBedWithBlend(state.sheep).primary;
  } else {
    id = "lobby";
  }
  // ABC render is offline & deterministic — pick the first variant.
  const variants = lib.beds.get(id as BedId);
  return variants && variants.length > 0 ? variants[0] : null;
}

/** Build the ordered list of bed-blocks from a round template. */
function planBlocks(template: RoundTemplate, lib: BedLibrary): BedBlock[] {
  const scenario = generateScenario(template);
  const blocks: BedBlock[] = [];
  for (let i = 0; i < scenario.waypoints.length - 1; i++) {
    const w1 = scenario.waypoints[i];
    const w2 = scenario.waypoints[i + 1];
    const seconds = w2.t - w1.t;
    if (seconds <= 0) continue;

    const state: FullGameState = {
      state: w1.state as StructuralState,
      perspective: w1.perspective as Perspective,
      sheep: w1.sheep ? { ...DEFAULT_SHEEP, ...w1.sheep } : undefined,
      wolf: w1.wolf ? { ...DEFAULT_WOLF, ...w1.wolf } : undefined,
      roundHook: null,
    };
    const bed = pickBed(state, lib);
    if (!bed) continue;

    const beats = (seconds / 60) * bed.tempo;
    const bars = Math.max(1, Math.round(beats / bed.meter[0]));
    // Fold consecutive blocks with the same bed into one
    const last = blocks[blocks.length - 1];
    if (last && last.bed.id === bed.id) {
      last.bars += bars;
    } else {
      blocks.push({ bed, bars, label: w1.label });
    }
  }
  return blocks;
}

// ── ABC primitives ──

function midiToAbc(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const noteNames = ["C", "^C", "D", "^D", "E", "F", "^F", "G", "^G", "A", "^A", "B"];
  const name = noteNames[pc];
  const accidental = name.startsWith("^") ? "^" : "";
  const baseLetter = accidental ? name.slice(1) : name;

  const oct = Math.floor((midi - 60) / 12);
  let letter: string;
  let suffix = "";
  if (oct >= 0) {
    letter = baseLetter.toLowerCase();
    if (oct > 0) suffix = "'".repeat(oct);
  } else {
    letter = baseLetter.toUpperCase();
    if (oct < -1) suffix = ",".repeat(-oct - 1);
  }
  return accidental + letter + suffix;
}

function durationToAbc(beats: number): string {
  // L:1/4: 1 unit = quarter note.
  // Common values: 1, 2, 3, 4, 0.5, 0.25, 1.5, 0.75
  if (Math.abs(beats - 1) < 0.001) return "";
  if (Math.abs(beats - 2) < 0.001) return "2";
  if (Math.abs(beats - 3) < 0.001) return "3";
  if (Math.abs(beats - 4) < 0.001) return "4";
  if (Math.abs(beats - 0.5) < 0.001) return "/";
  if (Math.abs(beats - 0.25) < 0.001) return "/4";
  if (Math.abs(beats - 1.5) < 0.001) return "3/2";
  if (Math.abs(beats - 0.75) < 0.001) return "3/4";
  // Fallback: format as fraction or decimal
  if (beats < 1) return `/${(1 / beats).toString()}`;
  return beats.toString();
}

function velocityToDynamic(v: number): string {
  if (v >= 0.95) return "ff";
  if (v >= 0.8) return "f";
  if (v >= 0.65) return "mf";
  if (v >= 0.5) return "mp";
  if (v >= 0.35) return "p";
  return "pp";
}

function keyToAbc(key: { root: string; mode: string }): string {
  // ABC: K:G, K:Gm, K:Em
  const root = key.root;
  const m = key.mode.startsWith("min") ? "m" : "";
  return `${root}${m}`;
}

// ── Voice mapping (role → register name) ──

const ROLE_TO_VOICE_NAME: Record<string, string> = {
  melody: "High Part 1",
  counter: "High Part 2",
  arp: "Mid Part 1",
  pad: "Mid Part 2",
  bass: "Low Part 1",
  perc: "Low Part 2",
  drone: "Low Part 3",
};

const ROLE_ORDER = ["melody", "counter", "arp", "pad", "bass", "perc", "drone"];

// ── Per-layer bar rendering ──

interface NoteEventByBeat {
  notes: NoteEvent[];
}

/** djb2-style string hash. Stable across runs; used to seed per-loop variation. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

/** Apply deterministic per-loop micro-variation to a bar's note list.
 *  Foundation roles (bass, drone) and percussion are stable.
 *  Color/melody/arp/pad layers receive one of:
 *    - rest-substitute: drop the bar's last note (small breath at end)
 *    - octave-displace: lift the highest note up an octave
 *    - thin: drop every other note (arp/pad bars with >=4 notes only)
 *  Variation key is hash(songSeed/segId/role/loopIdx/segBar). Loop 0 also
 *  varies (lighter rate) so different songs starting from the same bed don't
 *  share a byte-identical opener — round 3 found this cohort fingerprint
 *  was the dominant source-guesser tell. */
function varyBarNotes(
  barNotes: NoteEvent[],
  songSeed: string,
  segId: string,
  role: string,
  loopIdx: number,
  segBar: number,
): NoteEvent[] {
  if (role === "bass" || role === "drone" || role === "perc") return barNotes;
  if (barNotes.length === 0) return barNotes;
  const key = hashString(`${songSeed}/${segId}/${role}/${loopIdx}/${segBar}`);
  // Loop 0: 18% variation rate (light — preserves the authored shape).
  // Loops 1+: 35% variation rate, growing slightly with loopIdx to break
  // long-hold repetition. Arp/pad get a small bump because their wall-of-
  // ostinato is the second-most-cited gen tell.
  const baseRate = loopIdx === 0 ? 18 : Math.min(50, 35 + loopIdx * 3);
  const arpPadBump = (role === "arp" || role === "pad") ? 8 : 0;
  if ((key % 100) >= baseRate + arpPadBump) return barNotes;
  const variation = Math.floor(key / 100) % 3;
  if (variation === 0) {
    return barNotes.slice(0, -1);
  }
  if (variation === 1) {
    let maxIdx = 0;
    for (let i = 1; i < barNotes.length; i++) {
      if (barNotes[i].midi > barNotes[maxIdx].midi) maxIdx = i;
    }
    return barNotes.map((n, i) => i === maxIdx ? { ...n, midi: n.midi + 12 } : n);
  }
  if (barNotes.length < 4) return barNotes.slice(0, -1);
  return barNotes.filter((_, i) => i % 2 === 0);
}

/** Per-song layer surface transform — root-fix for round-4's V3 arpeggio
 *  cohort tell. Two songs playing the same bed got byte-identical V3 notes
 *  because the bed library is shared and per-bar variation only nibbles at
 *  the surface. Applying a deterministic per-song transform to color/arp/
 *  counter/pad layers means same-bed-different-song produces audibly
 *  different content while preserving the bed's harmonic/motivic identity.
 *
 *  Foundation (bass, drone, perc) and the melody layer keep identity:
 *    - foundation is load-bearing; transposing the bass would clash with
 *      the harmonic structure
 *    - melody carries the per-arc hook; transforming it would break the
 *      song's recognizable theme
 *
 *  Octave shifts are skipped if they'd push the layer outside MIDI 24-96
 *  (C1 to C7) — keeps everything in playable range. */
type LayerTransform = "identity" | "octave-up" | "octave-down" | "thin-half";

function pickLayerTransform(
  songSeed: string,
  segId: string,
  layerRole: string,
  layerId: string,
): LayerTransform {
  if (layerRole === "melody" || layerRole === "bass" || layerRole === "drone" || layerRole === "perc") {
    return "identity";
  }
  if (!songSeed) return "identity";
  const key = hashString(`${songSeed}/${segId}/${layerId}/transform`);
  // Weighted toward identity (40%) so most layers preserve authored shape.
  // Octave shifts and thinning each get 20% — enough to break cohort
  // identity, not so much that the bed sounds wrong.
  const weighted: LayerTransform[] = [
    "identity", "identity",
    "octave-up",
    "octave-down",
    "thin-half",
  ];
  return weighted[key % weighted.length];
}

function applyLayerTransform(notes: NoteEvent[], transform: LayerTransform): NoteEvent[] {
  if (transform === "identity" || notes.length === 0) return notes;
  if (transform === "octave-up") {
    const maxMidi = Math.max(...notes.map(n => n.midi));
    if (maxMidi + 12 > 96) return notes;
    return notes.map(n => ({ ...n, midi: n.midi + 12 }));
  }
  if (transform === "octave-down") {
    const minMidi = Math.min(...notes.map(n => n.midi));
    if (minMidi - 12 < 24) return notes;
    return notes.map(n => ({ ...n, midi: n.midi - 12 }));
  }
  if (transform === "thin-half") {
    if (notes.length < 4) return notes;
    return notes.filter((_, i) => i % 2 === 0);
  }
  return notes;
}

/** Per-loop layer activity — root-fix for round-4's macro-form B = B'
 *  repetition. The renderer's half-rotation only produces 2 distinct
 *  sequences alternating; the listener perceives "same loop again" because
 *  the texture doesn't change. This drops one priority>=1 layer per loop
 *  past loop 0 deterministically, so the texture varies between iterations.
 *
 *  Foundation (priority 0) always stays active.
 *  Melody also stays active even at priority 2 — it's the song's identity.
 *  Drop rates: priority 2 (color) 25% per loop, priority 1 (core) 12%. */
function isLayerActiveForLoop(
  songSeed: string,
  segId: string,
  layerRole: string,
  layerId: string,
  priority: number,
  loopIdx: number,
): boolean {
  if (priority === 0) return true;
  if (loopIdx === 0) return true;
  if (layerRole === "melody") return true;
  if (!songSeed) return true;
  const key = hashString(`${songSeed}/${segId}/${layerId}/active/${loopIdx}`);
  const dropRate = priority === 2 ? 25 : 12;
  return (key % 100) >= dropRate;
}

/** Render a single layer for `bars` bars (looping the underlying segment as needed),
 *  organized as bar-by-bar token lines. */
function renderLayerBars(
  layer: Layer | undefined,
  bars: number,
  segBars: number,
  beatsPerBar: number,
  ctx: { currentDynamic: string },
  segId: string = "",
  songSeed: string = "",
): string[] {
  const out: string[] = [];
  if (!layer) {
    const restBar = `z${beatsPerBar > 1 ? beatsPerBar : ""}`;
    for (let b = 0; b < bars; b++) out.push("| " + restBar + " ");
    return out;
  }

  // Per-song layer surface transform (Phase B): apply once at the layer
  // level so that two songs playing the same bed get audibly different
  // arp/counter/pad surfaces. Foundation + melody preserve identity.
  const layerTransform = pickLayerTransform(songSeed, segId, layer.role, layer.id);
  const sourceNotes = applyLayerTransform(layer.notes, layerTransform);

  // Loop bookkeeping: half-rotate the bed each cycle so bars don't replay in
  // the same order; cadence bars stay at phrase boundaries. On top of that,
  // varyBarNotes applies per-bar micro-variation seeded by songSeed so two
  // songs that start from the same bed don't share a byte-identical opener.
  // Round 3 found that uniform opener was the dominant cohort tell (every gen
  // piece opened with !mp!g2 a b | d'2 b2). Per-song seed breaks that.
  // Also applies a per-song initial bar offset so the very first segBar isn't
  // always 0 — different songs start at different phrase points.
  const halfRotate = Math.floor(segBars / 2);
  const songOffset = songSeed
    ? hashString(`${songSeed}/${segId}/${layer.role}/start`) % segBars
    : 0;
  for (let outBar = 0; outBar < bars; outBar++) {
    const loopCount = Math.floor(outBar / segBars);
    const barWithinLoop = outBar - loopCount * segBars;
    const segBar = (barWithinLoop + songOffset + loopCount * halfRotate) % segBars;
    const barStart = segBar * beatsPerBar;
    const barEnd = barStart + beatsPerBar;

    // Per-loop layer activity (Phase A2): drop priority>=1 layers on selected
    // loops to break macro-form B = B' repetition. Renders an empty bar
    // instead of the layer's authored notes for that loop iteration.
    const active = isLayerActiveForLoop(
      songSeed, segId, layer.role, layer.id, layer.priority, loopCount,
    );
    if (!active) {
      out.push("| " + `z${beatsPerBar > 1 ? beatsPerBar : ""}` + " ");
      continue;
    }

    let barNotes = sourceNotes.filter(n => n.beat >= barStart && n.beat < barEnd);
    barNotes.sort((a, b) => a.beat - b.beat);
    barNotes = varyBarNotes(barNotes, songSeed, segId, layer.role, loopCount, segBar);

    // Group notes by start-beat into chords (same beat + same duration → chord)
    interface Group { beat: number; duration: number; midis: number[]; velocity?: number; articulation?: string; }
    const groups: Group[] = [];
    for (const n of barNotes) {
      const tail = groups[groups.length - 1];
      if (tail
        && Math.abs(tail.beat - n.beat) < 0.001
        && Math.abs(tail.duration - n.duration) < 0.001) {
        tail.midis.push(n.midi);
      } else {
        groups.push({ beat: n.beat, duration: n.duration, midis: [n.midi], velocity: n.velocity, articulation: n.articulation });
      }
    }

    let cursor = barStart;
    const tokens: string[] = [];
    for (const g of groups) {
      if (g.beat > cursor + 0.001) {
        tokens.push(`z${durationToAbc(g.beat - cursor)}`);
      }
      const dyn = velocityToDynamic(g.velocity ?? 0.7);
      let dynPrefix = "";
      if (dyn !== ctx.currentDynamic) {
        dynPrefix = `!${dyn}!`;
        ctx.currentDynamic = dyn;
      }
      let artPrefix = "";
      if (g.articulation === "accent") artPrefix = "!accent!";
      else if (g.articulation === "tenuto") artPrefix = "!tenuto!";
      else if (g.articulation === "staccato") artPrefix = ".";
      const sortedMidis = [...g.midis].sort((a, b) => a - b);
      const pitchPart = sortedMidis.length > 1
        ? `[${sortedMidis.map(midiToAbc).join("")}]`
        : midiToAbc(sortedMidis[0]);
      tokens.push(dynPrefix + artPrefix + pitchPart + durationToAbc(g.duration));
      cursor = g.beat + g.duration;
    }
    if (cursor < barEnd - 0.001) {
      tokens.push(`z${durationToAbc(barEnd - cursor)}`);
    }
    out.push("| " + tokens.join(" ") + " ");
  }
  return out;
}

// ── Top-level render ──

export function renderRoundToAbc(
  template: RoundTemplate,
  lib: BedLibrary,
  songNumber: number,
): string {
  const blocks = planBlocks(template, lib);
  if (blocks.length === 0) return `X:1\nT:Song-${pad(songNumber)}\nM:4/4\nL:1/4\nQ:1/4=120\nK:C\n`;

  // Collect all roles that appear across all blocks
  const seen = new Set<string>();
  for (const blk of blocks) for (const l of blk.bed.layers) seen.add(l.id);
  const roles = ROLE_ORDER.filter(r => seen.has(r));

  // Header
  const firstBed = blocks[0].bed;
  const lines: string[] = [];
  lines.push("X:1");
  lines.push(`T:Song-${pad(songNumber)}`);
  lines.push("M:4/4");
  lines.push("L:1/4");
  lines.push(`Q:1/4=${firstBed.tempo}`);
  lines.push(`K:${keyToAbc(firstBed.key)}`);
  for (const role of roles) {
    const name = ROLE_TO_VOICE_NAME[role] ?? role;
    lines.push(`V:V${roles.indexOf(role) + 1} name="${name}"`);
  }

  // Body: per voice
  for (const role of roles) {
    const voiceLines: string[] = [];
    voiceLines.push(`V:V${roles.indexOf(role) + 1}`);
    let prevKey = firstBed.key;
    let prevTempo = firstBed.tempo;
    const ctx = { currentDynamic: "" };

    for (const block of blocks) {
      const layer = block.bed.layers.find(l => l.id === role);
      const beatsPerBar = block.bed.meter[0];

      // Emit inline directives if anything changed
      const dirs: string[] = [];
      if (block.bed.key.root !== prevKey.root || block.bed.key.mode !== prevKey.mode) {
        dirs.push(`[K:${keyToAbc(block.bed.key)}]`);
        prevKey = block.bed.key;
        ctx.currentDynamic = ""; // re-emit dynamics after a key change
      }
      if (block.bed.tempo !== prevTempo) {
        dirs.push(`[Q:1/4=${block.bed.tempo}]`);
        prevTempo = block.bed.tempo;
      }

      const barLines = renderLayerBars(
        layer, block.bars, block.bed.bars, beatsPerBar, ctx,
        block.bed.id, `song-${songNumber}`,
      );
      if (barLines.length > 0) {
        // Glue directives onto the first bar's start
        if (dirs.length > 0) {
          barLines[0] = dirs.join("") + barLines[0];
        }
        // Each bar in barLines already starts with "| " — concatenate and add closing "|"
        voiceLines.push(barLines.join("") + "|");
      }
    }

    lines.push(voiceLines.join("\n"));
    lines.push("");
  }

  return lines.join("\n");
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
