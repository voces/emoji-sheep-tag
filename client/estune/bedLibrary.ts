/**
 * Bed library: load .seg files (with hook slots) into compiled Segments,
 * indexed by BedId for runtime selection.
 *
 * The library can be rebuilt with a different hook to swap leitmotif
 * across rounds.
 *
 * Variants: each bed slot holds an array of Segments (one or more
 * authored alternatives). The bed director picks one variant per round
 * deterministically from the engine's session seed; subsequent rounds
 * cycle through the variants for variety. See pickVariant in
 * bedDirector.ts.
 */

import { type Segment, type BedId } from "./types.ts";
import { compileSegment } from "./compiler.ts";
import { type HookSpec, parseHookFile } from "./hooks.ts";
import { expandHookSlots } from "./hookSlots.ts";

export interface BedLibrary {
  /** Beds keyed by id; each maps to one or more variant segments. */
  beds: Map<BedId, Segment[]>;
  /** Hook used when this library was built. */
  hook: HookSpec;
}

export interface BedSource {
  bed: BedId;
  /** Raw .seg text including %HOOK_*% slots. */
  text: string;
  /** Root pitch class for hook slot expansion (matches segment's key root). */
  rootName: string;
  /** Beats per bar; matches segment meter. */
  beatsPerBar: number;
  /** Optional per-bed hook override. If omitted, the library's default hook is used. */
  hook?: HookSpec;
}

/** Build a bed library by expanding hooks and compiling each segment.
 *  Multiple sources with the same `bed` id are accumulated as variants. */
export function buildBedLibrary(sources: BedSource[], hook: HookSpec): BedLibrary {
  const beds = new Map<BedId, Segment[]>();
  for (const src of sources) {
    const hookForBed = src.hook ?? hook;
    const expanded = expandHookSlots(src.text, hookForBed, src.rootName, src.beatsPerBar);
    const seg = compileSegment(expanded);
    const list = beds.get(src.bed);
    if (list) list.push(seg);
    else beds.set(src.bed, [seg]);
  }
  return { beds, hook };
}

/** Convenience: build from raw text strings instead of files.
 *  If `wolfHookText` is provided, it is used for any bed whose id appears in
 *  the WOLF_BEDS set below; sheep beds and structural beds use `hookText`. */
const WOLF_BEDS = new Set([
  "patrolling", "stalking", "attack", "desperate", "desperate-frustrated",
  "build-wolf-bulldog", "build-wolf-switch", "build-wolf-survival",
  "endgame-wolf-survival", "endgame-wolf-bulldog",
]);

export function buildBedLibraryFromText(
  hookText: string,
  sources: BedSource[],
  wolfHookText?: string,
): BedLibrary {
  const sheepHook = parseHookFile(hookText);
  const wolfHook = wolfHookText ? parseHookFile(wolfHookText) : undefined;
  const enriched: BedSource[] = wolfHook
    ? sources.map(s => ({ ...s, hook: s.hook ?? (WOLF_BEDS.has(s.bed) ? wolfHook : sheepHook) }))
    : sources;
  return buildBedLibrary(enriched, sheepHook);
}
