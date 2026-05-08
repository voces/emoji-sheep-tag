/**
 * V3 MIDI Renderer: plays compiled segments through SF2.
 *
 * Handles:
 * - Segment playback (reading NoteEvents, scheduling through SF2)
 * - Per-layer gain control (vertical mixing)
 * - Segment looping
 * - Crossfade between two segments (horizontal transitions)
 * - Tempo scaling and transposition
 */

import { noteOn, allNotesOff } from "./sf2.ts";
import { type Segment, type Layer, type NoteEvent, type MoodParams, type BleedSpec } from "./types.ts";

// ── Channel allocation ──

class ChannelAllocator {
  private layerToChannel = new Map<string, number>();
  private used = new Set<number>();

  get(layerId: string): number {
    const existing = this.layerToChannel.get(layerId);
    if (existing !== undefined) return existing;
    for (let ch = 0; ch < 16; ch++) {
      if (ch === 9 || this.used.has(ch)) continue;
      this.layerToChannel.set(layerId, ch);
      this.used.add(ch);
      return ch;
    }
    return 0; // fallback
  }

  release(layerId: string): void {
    const ch = this.layerToChannel.get(layerId);
    if (ch !== undefined) {
      this.layerToChannel.delete(layerId);
      this.used.delete(ch);
    }
  }

  clear(): void {
    this.layerToChannel.clear();
    this.used.clear();
  }
}

// ── Layer player ──

interface LayerPlayer {
  layer: Layer;
  /** Per-loop rotated note view. Resets to layer.notes on segment start;
   *  half-rotated by loopIndex on each loop reset for variation. */
  notes: NoteEvent[];
  /** Index into `notes` — next note to schedule. */
  cursor: number;
  /** Current gain (0-1) for vertical mixing. */
  gain: number;
  /** Target gain (smoothed toward). */
  targetGain: number;
  /** Channel assigned for this layer. */
  channel: number;
}

// ── Segment player ──

export interface SegmentPlayer {
  segment: Segment;
  layers: LayerPlayer[];
  /** Global beat when this segment started playing. */
  startBeat: number;
  /** Master gain for crossfading (0-1). */
  masterGain: number;
  /** Semitone transposition applied to all notes. */
  transposition: number;
  /** Tempo override (null = use segment's base tempo). */
  tempoOverride: number | null;
  /** Whether this player is actively being played. */
  active: boolean;
  /** True if this segment should loop when it ends. */
  loop: boolean;
  /** How many times this segment has looped. Drives per-loop note rotation. */
  loopIndex: number;
}

// ── Pending note-off tracking ──

interface PendingOff {
  stopFn: () => void;
  endBeat: number;
  layerId: string;
  channel: number;
  midi: number;
}

// ── Velocity computation ──

const ROLE_BASE_VELOCITY: Record<string, number> = {
  melody: 0.85,
  counter: 0.65,
  bass: 0.70,
  arp: 0.55,
  pad: 0.50,
  perc: 0.45,
  drone: 0.40,
  sparkle: 0.55,
};

function computeVelocity(
  role: string,
  mood: MoodParams,
  layerGain: number,
  masterGain: number,
  noteVelocity?: number,
): number {
  // Per-note velocity (from segment dynamics) overrides role default
  const base = noteVelocity ?? ROLE_BASE_VELOCITY[role] ?? 0.6;
  // Mood-driven scaling on top
  const energyScale = 0.3 + mood.energy * 0.7;
  return Math.min(1.0, base * energyScale * layerGain * masterGain);
}

/** Compute the effective gain multiplier for a palette-bleed layer. The
 *  bleed-tagged layer is authored at *full intensity*; this returns the
 *  scaling applied to its velocity at scheduling time, in [0, 1].
 *
 *  Source values come from `mood.tension` directly (per [musical-foundation.md
 *  §3] tension is the wolf-proximity-driven facet). Sheep-side bleed uses
 *  `tension`; wolf-side uses `inverse-tension` (sheep colors creep in when
 *  the wolf is losing). The per-bed `floor` is the minimum gain the layer
 *  retains regardless of source — used so beds like `hero` keep a baseline
 *  pulse even at low tension. */
export function computeBleedGain(bleed: BleedSpec | undefined, mood: MoodParams): number {
  if (!bleed) return 1.0;
  const t = Math.max(0, Math.min(1, mood.tension));
  const sourceValue = bleed.source === "inverse-tension" ? 1 - t : t;
  return Math.max(bleed.floor, sourceValue);
}

/** Compute the breath-pattern gain (1.0 or 0.0) for a layer at a given dwell.
 *
 *  Returns 0.0 when (a) the segment has a `breath` spec, (b) `layerId` is
 *  in `breath.layers`, and (c) we're inside the in-breath window of the
 *  current cycle. Otherwise 1.0.
 *
 *  Cycle math: dwellBars >= breath.after triggers cycling. Within each
 *  `breath.every`-bar cycle, the first `breath.hold` bars are silenced.
 *  This produces a periodic ebb-and-flow during long bed holds without
 *  permanently dropping intensity.
 *
 *  The check runs every scheduling tick, but the gain only changes at
 *  bar boundaries (since `dwellBars = floor(dwellBeats / beatsPerBar)`).
 *  Notes that fall on a bar where the layer is silenced are skipped
 *  entirely; resumed bars schedule normally. */
export function computeBreathGain(
  segment: Segment,
  layerId: string,
  dwellBeats: number,
): number {
  const breath = segment.breath;
  if (!breath) return 1.0;
  if (!breath.layers.includes(layerId)) return 1.0;
  const beatsPerBar = segment.meter[0];
  const dwellBars = Math.floor(dwellBeats / beatsPerBar);
  if (dwellBars < breath.after) return 1.0;
  const cyclePos = (dwellBars - breath.after) % breath.every;
  return cyclePos < breath.hold ? 0.0 : 1.0;
}

// ── Renderer ──

export interface RendererState {
  /** Primary segment player (current). */
  primary: SegmentPlayer | null;
  /** Secondary segment player (fading out during crossfade). */
  secondary: SegmentPlayer | null;
  channels: ChannelAllocator;
  /** Active notes keyed by "channel:midi" for O(1) lookup. */
  pendingOffs: Map<string, PendingOff>;
  /** Current mood for velocity/layer decisions. */
  mood: MoodParams;
  /** Global beat counter (advances with time). */
  currentBeat: number;
  /** Audio context sample rate for timing. */
  sampleRate: number;
  /** Beats of lookahead for scheduling. */
  lookaheadBeats: number;
  /** Muted layers (still tracked, just silent). */
  mutedLayers: Set<string>;
  /** Crossfade state. */
  crossfade: { startBeat: number; durationBeats: number } | null;
  /** Callback when a note is played (for piano roll). */
  onNote?: (layerId: string, midi: number, velocity: number, beat: number, duration: number) => void;
  /** Per-session seed for layer transforms and per-loop activity gating.
   *  Same seed → same transform choices and same active-layer pattern across
   *  loop iterations. Mirrors the abcRender per-song variation system so the
   *  runtime sounds like the eval. Stable for the duration of a game session;
   *  reset when starting a new round. */
  sessionSeed: string;
}

export function createRenderer(sampleRate: number = 44100): RendererState {
  return {
    primary: null,
    secondary: null,
    channels: new ChannelAllocator(),
    pendingOffs: new Map(),
    mood: { tension: 0, energy: 0.5, urgency: 0 },
    currentBeat: 0,
    sampleRate,
    lookaheadBeats: 4,
    mutedLayers: new Set(),
    crossfade: null,
    sessionSeed: "",
  };
}

/** Set the per-session seed. Stable across the session; resets on new round.
 *  Drives per-session layer transforms (octave shifts, thinning) and per-loop
 *  activity gating (which layers drop on which loop iterations). */
export function setSessionSeed(renderer: RendererState, seed: string): void {
  renderer.sessionSeed = seed;
}

/** djb2 string hash. Stable across runs. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h >>> 0;
}

/** Per-session layer surface transform. Mirrors abcRender's pickLayerTransform.
 *  Foundation (bass/drone/perc) and melody preserve identity; color layers
 *  (counter/arp/pad) get one of {identity, octave-up, octave-down, thin-half}.
 *  Octave shifts respect MIDI 24-96 range. */
type LayerTransform = "identity" | "octave-up" | "octave-down" | "thin-half";

function pickLayerTransform(
  sessionSeed: string,
  segId: string,
  layerRole: string,
  layerId: string,
): LayerTransform {
  if (
    layerRole === "melody" || layerRole === "bass" || layerRole === "drone" ||
    layerRole === "perc" || layerRole === "sparkle"
  ) {
    return "identity";
  }
  if (!sessionSeed) return "identity";
  const key = hashString(`${sessionSeed}/${segId}/${layerId}/transform`);
  const weighted: LayerTransform[] = [
    "identity", "identity",
    "octave-up", "octave-down", "thin-half",
  ];
  return weighted[key % weighted.length];
}

function applyLayerTransform(notes: NoteEvent[], transform: LayerTransform): NoteEvent[] {
  if (transform === "identity" || notes.length === 0) return notes;
  if (transform === "octave-up") {
    let maxMidi = notes[0].midi;
    for (const n of notes) if (n.midi > maxMidi) maxMidi = n.midi;
    if (maxMidi + 12 > 96) return notes;
    return notes.map(n => ({ ...n, midi: n.midi + 12 }));
  }
  if (transform === "octave-down") {
    let minMidi = notes[0].midi;
    for (const n of notes) if (n.midi < minMidi) minMidi = n.midi;
    if (minMidi - 12 < 24) return notes;
    return notes.map(n => ({ ...n, midi: n.midi - 12 }));
  }
  if (transform === "thin-half") {
    if (notes.length < 4) return notes;
    return notes.filter((_, i) => i % 2 === 0);
  }
  return notes;
}

/** Per-loop layer activity gate. Mirrors abcRender's isLayerActiveForLoop.
 *  Foundation always plays; melody always plays; color layers get a
 *  deterministic drop on selected loop iterations to break macro-form
 *  B = B' repetition. */
function isLayerActiveForLoop(
  sessionSeed: string,
  segId: string,
  layerRole: string,
  layerId: string,
  priority: number,
  loopIdx: number,
): boolean {
  if (priority === 0) return true;
  if (loopIdx === 0) return true;
  if (layerRole === "melody") return true;
  if (!sessionSeed) return true;
  const key = hashString(`${sessionSeed}/${segId}/${layerId}/active/${loopIdx}`);
  const dropRate = priority === 2 ? 25 : 12;
  return (key % 100) >= dropRate;
}

/** Tile a short layer's notes to fill the segment's totalBeats.
 *  A bed declares N bars, but individual layers may have fewer bars of material
 *  (e.g. an 8-bar melody phrase in a 16-bar bed). Without tiling, the layer
 *  exhausts its cursor mid-segment and goes silent until the segment-wide
 *  loop reset, producing audible gaps. This repeats the layer's content at
 *  bar-aligned offsets to fill the segment. The tiled notes are intentional
 *  literal repetition — composers can add variation by authoring full-length
 *  layers, which return as-is. */
function tileLayerToSegment(
  notes: NoteEvent[],
  totalBeats: number,
  beatsPerBar: number,
): NoteEvent[] {
  if (notes.length === 0) return notes;
  let lastEnd = 0;
  for (const n of notes) lastEnd = Math.max(lastEnd, n.beat + n.duration);
  // Round up to bar boundary; this is the layer's natural period.
  const layerPeriod = Math.max(beatsPerBar, Math.ceil(lastEnd / beatsPerBar) * beatsPerBar);
  if (layerPeriod >= totalBeats) return notes;
  const tiled: NoteEvent[] = [];
  for (let offset = 0; offset < totalBeats; offset += layerPeriod) {
    for (const n of notes) {
      const newBeat = n.beat + offset;
      if (newBeat >= totalBeats) continue;
      let dur = n.duration;
      if (newBeat + dur > totalBeats) dur = totalBeats - newBeat;
      if (dur > 0.001) tiled.push({ ...n, beat: newBeat, duration: dur });
    }
  }
  return tiled;
}

/** Create a SegmentPlayer for a segment.
 *  Per-session transforms are applied to each color layer's tiled notes once
 *  at construction time so two sessions playing the same bed sound different
 *  on color voices while sharing the same foundation/melody. */
export function createSegmentPlayer(
  segment: Segment,
  startBeat: number,
  channels: ChannelAllocator,
  transposition: number = 0,
  sessionSeed: string = "",
): SegmentPlayer {
  const beatsPerBar = segment.meter[0];
  const layers: LayerPlayer[] = segment.layers.map(layer => {
    const tiled = tileLayerToSegment(layer.notes, segment.totalBeats, beatsPerBar);
    const transform = pickLayerTransform(sessionSeed, segment.id, layer.role, layer.id);
    return {
      layer,
      notes: applyLayerTransform(tiled, transform),
      cursor: 0,
      gain: 1.0,
      targetGain: 1.0,
      channel: channels.get(`${segment.id}/${layer.id}`),
    };
  });

  return {
    segment,
    layers,
    startBeat,
    masterGain: 1.0,
    transposition,
    tempoOverride: null,
    active: true,
    loop: true,
    loopIndex: 0,
  };
}

/** Rotate a note list by `offsetBeats` for per-loop variation.
 *  Each note's beat is shifted by -offsetBeats (mod totalBeats), then notes are
 *  re-sorted. Notes whose duration would cross the loop boundary after rotation
 *  are clipped to fit within the loop. */
function rotateNotes(
  notes: NoteEvent[],
  offsetBeats: number,
  totalBeats: number,
): NoteEvent[] {
  if (offsetBeats === 0 || totalBeats === 0) return notes;
  const rotated: NoteEvent[] = [];
  for (const n of notes) {
    let newBeat = n.beat - offsetBeats;
    newBeat = ((newBeat % totalBeats) + totalBeats) % totalBeats;
    let dur = n.duration;
    if (newBeat + dur > totalBeats) dur = totalBeats - newBeat;
    if (dur > 0.001) rotated.push({ ...n, beat: newBeat, duration: dur });
  }
  rotated.sort((a, b) => a.beat - b.beat);
  return rotated;
}

/** Get the effective tempo for a segment player. */
export function getEffectiveTempo(player: SegmentPlayer, urgency: number = 0): number {
  const base = player.tempoOverride ?? player.segment.tempo;
  return base * (1.0 + urgency * 0.15);
}

/** Convert a beat offset to seconds at a given tempo. */
function beatsToSeconds(beats: number, bpm: number): number {
  return (beats / bpm) * 60;
}

/**
 * Schedule notes from a segment player that fall within the lookahead window.
 * Returns the scheduled notes for visualization.
 */
export function scheduleNotes(
  renderer: RendererState,
  player: SegmentPlayer,
  windowStart: number,
  windowEnd: number,
): void {
  if (!player.active) return;

  const totalBeats = player.segment.totalBeats;
  const tempo = getEffectiveTempo(player, renderer.mood.urgency);

  for (const lp of player.layers) {
    // Priority-based layer shedding
    const priorityGain = computeLayerPriorityGain(lp.layer.priority, renderer.mood.energy);
    // Palette-bleed: bleed-tagged layers are gain-modulated by mood.tension
    // (or its inverse for wolf-side sheep-color bleed). At zero effective
    // gain the layer's notes are suppressed by the velocity audibility
    // floor downstream — we don't have to skip them here.
    const bleedGain = computeBleedGain(lp.layer.bleed, renderer.mood);
    // Note: breath gain is per-note, not per-tick — see inside the note loop.
    const baseGain = lp.gain * priorityGain * bleedGain;
    const isBaseShed = baseGain < 0.05;

    // Per-loop layer activity: drop priority>=1 layers on selected loop
    // iterations (deterministic per session). Foundation and melody always
    // play. Loop 0 always plays. This is the live-audio equivalent of
    // abcRender's macro-form variation.
    const activeForLoop = isLayerActiveForLoop(
      renderer.sessionSeed, player.segment.id, lp.layer.role, lp.layer.id,
      lp.layer.priority, player.loopIndex,
    );

    while (lp.cursor < lp.notes.length) {
      const note = lp.notes[lp.cursor];
      const globalBeat = player.startBeat + note.beat;

      if (globalBeat > windowEnd) break;

      // Advance cursor past notes we've passed (even if shed)
      if (globalBeat < windowStart) {
        lp.cursor++;
        continue;
      }

      // Breath-pattern: compute per-note dwell so the silenced bars
      // align with note play-time, not schedule-time. Without this, a
      // note scheduled within the lookahead window inherits the breath
      // state of the schedule moment (which may be a few beats earlier),
      // producing audible drift on the in-breath edges.
      const noteDwellBeats = player.loopIndex * totalBeats + note.beat;
      const breathGain = computeBreathGain(player.segment, lp.layer.id, noteDwellBeats);
      const effectiveGain = baseGain * breathGain;
      const isShed = isBaseShed || effectiveGain < 0.05;

      // Schedule the note if audible
      if (!isShed && activeForLoop) {
        const velocity = computeVelocity(
          lp.layer.role, renderer.mood, effectiveGain, player.masterGain,
          note.velocity,
        );

        if (velocity >= 0.05 && !renderer.mutedLayers.has(lp.layer.id)) {
          const midi = note.midi + player.transposition;

          const endBeat = globalBeat + note.duration;
          const noteKey = `${lp.channel}:${midi}`;

          // Same channel+pitch already playing? Just extend it — no gap.
          const existing = renderer.pendingOffs.get(noteKey);
          if (existing) {
            existing.endBeat = endBeat;
          } else {
            // Clear any pending note-off for same layer (different pitch)
            // e.g. drone changing pitch — stop old before starting new
            for (const [key, off] of renderer.pendingOffs) {
              if (off.channel === lp.channel && off.layerId === lp.layer.id) {
                off.stopFn();
                renderer.pendingOffs.delete(key);
              }
            }

            const stopFn = noteOn(midi, lp.layer.instrument, velocity, lp.channel);
            renderer.pendingOffs.set(noteKey, {
              stopFn, endBeat, layerId: lp.layer.id,
              channel: lp.channel, midi,
            });
          }

          renderer.onNote?.(lp.layer.id, midi, velocity, globalBeat, note.duration);
        }
      }

      lp.cursor++;
    }
  }

  // Loop: reset ALL cursors together when the segment has been fully played.
  // Apply half-rotation per loop iteration to vary which bars play first,
  // and re-apply the per-session layer transform so subsequent loops stay
  // consistent with the first loop's surface (e.g. an octave-shifted arp
  // stays octave-shifted on every loop, not just loop 0).
  if (player.loop) {
    const allExhausted = player.layers.every(lp => lp.cursor >= lp.notes.length);
    if (allExhausted) {
      player.loopIndex++;
      const beatsPerBar = player.segment.meter[0];
      const halfRotateBars = Math.floor(player.segment.bars / 2);
      const offsetBeats = halfRotateBars * beatsPerBar * player.loopIndex;
      const useRotation = halfRotateBars > 0 && offsetBeats % totalBeats !== 0;
      for (const lp of player.layers) {
        const tiled = tileLayerToSegment(lp.layer.notes, totalBeats, beatsPerBar);
        const transform = pickLayerTransform(
          renderer.sessionSeed, player.segment.id, lp.layer.role, lp.layer.id,
        );
        const transformed = applyLayerTransform(tiled, transform);
        lp.notes = useRotation
          ? rotateNotes(transformed, offsetBeats, totalBeats)
          : transformed;
        lp.cursor = 0;
      }
      player.startBeat += totalBeats;
    }
  }
}

/** Compute gain multiplier based on layer priority and current energy. */
function computeLayerPriorityGain(priority: number, energy: number): number {
  // Foundation (0): always full
  if (priority === 0) return 1.0;
  // Core (1): fade below energy 0.15
  if (priority === 1) {
    if (energy >= 0.2) return 1.0;
    return energy / 0.2;
  }
  // Color (2): fade below energy 0.3
  if (energy >= 0.4) return 1.0;
  if (energy <= 0.1) return 0.0;
  return (energy - 0.1) / 0.3;
}

/**
 * Process note-offs for notes whose duration has elapsed.
 */
export function processNoteOffs(renderer: RendererState, currentBeat: number): void {
  for (const [key, off] of renderer.pendingOffs) {
    if (off.endBeat < currentBeat) {
      off.stopFn();
      renderer.pendingOffs.delete(key);
    }
  }
}

/**
 * The main tick function — called from setInterval or requestAnimationFrame.
 * Advances the beat counter, schedules upcoming notes, processes note-offs.
 */
export function rendererTick(renderer: RendererState, currentBeat: number): void {
  renderer.currentBeat = currentBeat;
  const windowStart = currentBeat;
  const windowEnd = currentBeat + renderer.lookaheadBeats;

  // Drive crossfade progression with equal-power curves so the midpoint
  // doesn't drop ~3dB. Linear gain at progress=0.5 leaves both beds at
  // 0.5, summing to 0.5 of either bed's full-volume RMS — audible as a
  // dip on every transition, especially during rapid threat oscillation.
  // sin/cos halves of a quarter-cycle satisfy a^2 + b^2 = 1, so
  // uncorrelated layered audio holds perceived loudness constant.
  if (renderer.crossfade) {
    const elapsed = currentBeat - renderer.crossfade.startBeat;
    const progress = Math.min(1, Math.max(0, elapsed / renderer.crossfade.durationBeats));
    const fadeIn = Math.sin(progress * Math.PI / 2);
    const fadeOut = Math.cos(progress * Math.PI / 2);
    if (renderer.primary) renderer.primary.masterGain = fadeIn;
    if (renderer.secondary) {
      renderer.secondary.masterGain = fadeOut;
      if (progress >= 1) {
        stopPlayer(renderer, renderer.secondary);
        renderer.secondary = null;
        renderer.crossfade = null;
      }
    }
  }

  // Process note-offs FIRST so they don't kill notes we're about to start
  processNoteOffs(renderer, currentBeat);

  // Schedule from primary player
  if (renderer.primary) {
    scheduleNotes(renderer, renderer.primary, windowStart, windowEnd);
  }

  // Schedule from secondary player (during crossfade)
  if (renderer.secondary) {
    scheduleNotes(renderer, renderer.secondary, windowStart, windowEnd);
  }
}

/**
 * Start playing a segment. If something is already playing, crossfade.
 */
/** Default crossfade duration in beats. */
const DEFAULT_CROSSFADE = 4;

/** Snap policy for the new segment's start beat:
 *   - "phrase": next 4-bar phrase boundary aligned to the *outgoing* bed's
 *               start (or the bed's loop length if shorter than 4 bars).
 *               The right default for parametric crossfades — lets the
 *               currently-playing phrase complete instead of cutting it
 *               mid-line. Worst-case wait: ~4 bars (~7s at 130 BPM).
 *   - "bar":    next bar boundary (preserves bar alignment but can land
 *               mid-phrase). Use when phrase context is irrelevant or no
 *               primary bed exists yet.
 *   - "beat":   next beat boundary (~1 beat max wait). Use for structural
 *               transitions and discrete switches where the listener
 *               expects the music to react quickly to a game event.
 *   - "now":    no snap (begin crossfade immediately). Tightest possible;
 *               can produce mid-beat seams in voices that don't tolerate it. */
export type StartBeatSnap = "phrase" | "bar" | "beat" | "now";

/** Bars per phrase used by the "phrase" snap mode. Most active beds in the
 *  catalogue are 4-bar or multiple-of-4-bar phrases, so 4 is the natural
 *  unit. Beds shorter than 4 bars fall back to the bed's own loop length. */
const PHRASE_BARS = 4;

function snapStartBeat(
  currentBeat: number,
  newSegment: Segment,
  primary: SegmentPlayer | null,
  snap: StartBeatSnap,
): number {
  if (snap === "now") return currentBeat;
  if (snap === "beat") return Math.ceil(currentBeat);
  if (snap === "phrase" && primary) {
    // Align to a phrase boundary in the OUTGOING bed's frame — that's the
    // pulse the listener has been tracking, so cutting on its boundary
    // sounds intentional. Phrase = min(4 bars, bed length) so very short
    // beds (e.g. 1-bar bulldog) don't try to wait for a phrase that
    // doesn't exist.
    const bpb = primary.segment.meter[0];
    const phraseBeats = bpb * Math.min(PHRASE_BARS, primary.segment.bars);
    const offset = currentBeat - primary.startBeat;
    const nextPhrase = Math.ceil(offset / phraseBeats) * phraseBeats;
    return primary.startBeat + nextPhrase;
  }
  // "bar", or "phrase" fallback when no primary exists yet (first segment
  // of the session): just snap to the new segment's bar.
  const bpb = newSegment.meter[0];
  return Math.ceil(currentBeat / bpb) * bpb;
}

export function playSegment(
  renderer: RendererState,
  segment: Segment,
  transposition: number = 0,
  crossfadeBeats: number = DEFAULT_CROSSFADE,
  snap: StartBeatSnap = "bar",
): void {
  const startBeat = snapStartBeat(renderer.currentBeat, segment, renderer.primary, snap);
  const newPlayer = createSegmentPlayer(
    segment, startBeat, renderer.channels, transposition, renderer.sessionSeed,
  );

  if (renderer.primary && crossfadeBeats > 0) {
    // If the existing primary is still waiting for its snapped startBeat
    // (phrase-snap wait), it hasn't produced audible notes yet. Treat the
    // new segment as a *replacement* of the waiting primary rather than
    // demoting it — that way we keep the currently-audible secondary
    // (the previous bed) playing through the phrase wait instead of
    // killing it and producing a silence gap.
    const primaryStillWaiting = renderer.currentBeat < renderer.primary.startBeat;
    if (primaryStillWaiting) {
      stopPlayer(renderer, renderer.primary);
      renderer.primary = newPlayer;
      renderer.primary.masterGain = 0.0;
      // Reuse the existing secondary (still at its prior gain) as the
      // outgoing source for the new crossfade. If there's no secondary
      // (clean start), no crossfade is needed.
      if (renderer.secondary) {
        renderer.crossfade = { startBeat, durationBeats: crossfadeBeats };
      } else {
        renderer.primary.masterGain = 1.0;
        renderer.crossfade = null;
      }
    } else {
      // Move current to secondary (fading out)
      if (renderer.secondary) {
        stopPlayer(renderer, renderer.secondary);
      }
      renderer.secondary = renderer.primary;
      renderer.secondary.masterGain = 1.0;
      renderer.primary = newPlayer;
      renderer.primary.masterGain = 0.0;
      renderer.crossfade = { startBeat, durationBeats: crossfadeBeats };
    }
  } else {
    if (renderer.primary) {
      stopPlayer(renderer, renderer.primary);
    }
    renderer.primary = newPlayer;
    renderer.crossfade = null;
  }
}

/** Stop a player and release its channels. */
function stopPlayer(renderer: RendererState, player: SegmentPlayer): void {
  player.active = false;
  for (const lp of player.layers) {
    renderer.channels.release(`${player.segment.id}/${lp.layer.id}`);
  }
  // Kill pending note-offs for this player's layers
  const layerIds = new Set(player.layers.map(lp => lp.layer.id));
  for (const [key, off] of renderer.pendingOffs) {
    if (layerIds.has(off.layerId)) {
      off.stopFn();
      renderer.pendingOffs.delete(key);
    }
  }
}

/** Stop everything. */
export function stopAll(renderer: RendererState): void {
  if (renderer.primary) stopPlayer(renderer, renderer.primary);
  if (renderer.secondary) stopPlayer(renderer, renderer.secondary);
  renderer.primary = null;
  renderer.secondary = null;
  for (const off of renderer.pendingOffs.values()) off.stopFn();
  renderer.pendingOffs.clear();
  renderer.channels.clear();
  allNotesOff();
}
