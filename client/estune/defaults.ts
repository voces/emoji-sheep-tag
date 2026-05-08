/**
 * Default engine wiring helpers — collapse the bed-library + stinger
 * boilerplate every consumer otherwise has to write by hand.
 *
 * These are parameterized over the segment-source maps because the source
 * repo doesn't have `segmentSources.generated.ts` (it's emitted only into
 * the vendor drop). The vendor `index.ts` wraps them with the inlined
 * sources so vendor consumers can call them with no arguments.
 */

import { type Segment } from "./types.ts";
import { type BedLibrary, type BedSource, buildBedLibraryFromText } from "./bedLibrary.ts";
import { compileSegment } from "./compiler.ts";
import { registerStinger, type V3EngineState } from "./engine.ts";

/** Bed → key root + perspective. Authoring contract for the canonical
 *  estune library: sheep-side beds are in G, wolf-side in E, all 4/4. */
const SHEEP_BEDS = [
  "building", "cautious", "terror", "hero", "spirit",
  "lobby",
  "build-sheep-bulldog", "build-sheep-switch", "build-sheep-survival",
] as const;

const WOLF_BEDS = [
  "patrolling", "stalking", "attack", "desperate", "desperate-frustrated",
  "build-wolf-bulldog", "build-wolf-switch", "build-wolf-survival",
] as const;

const SHEEP_ROOT = "G";
const WOLF_ROOT = "E";
const BEATS_PER_BAR = 4;

export interface DefaultLibraryOptions {
  /** Hook id to use for sheep-side beds. Defaults to "r2s-ascending". */
  sheepHook?: string;
  /** Hook id to use for wolf-side beds. Defaults to "wolf-call". */
  wolfHook?: string;
}

/** Find all variant source keys for a given bed id. The base file
 *  `<bed>.seg` is the canonical variant; additional `<bed>-<suffix>.seg`
 *  files (e.g. `lobby-A.seg`, `cautious-B.seg`) are picked up as
 *  alternative variants.
 *
 *  Excludes keys that are themselves registered as separate beds in
 *  `knownBeds` — e.g. `desperate-frustrated` is its own bed, not a
 *  variant of `desperate`, even though it shares the prefix. Without
 *  this guard a separate bed with a prefix-related name would end up
 *  in the parent bed's variant pool AND its own slot, doubling its
 *  presence in the library. */
function findVariantKeys(
  bed: string,
  bedSources: Record<string, string>,
  knownBeds: ReadonlySet<string>,
): string[] {
  const matches: string[] = [];
  for (const key of Object.keys(bedSources)) {
    if (key === bed) {
      matches.push(key);
      continue;
    }
    if (!key.startsWith(bed + "-")) continue;
    // Prefix-matched but is itself a separate bed → skip.
    if (knownBeds.has(key)) continue;
    matches.push(key);
  }
  return matches.sort();
}

/** Build the canonical bed library from inlined source maps. Variants
 *  are auto-discovered from filenames: `<bed>.seg` is the base, and
 *  any `<bed>-<suffix>.seg` files are picked up as alternative variants
 *  for the same bed slot. */
export function buildDefaultBedLibrary(
  bedSources: Record<string, string>,
  hookSources: Record<string, string>,
  opts: DefaultLibraryOptions = {},
): BedLibrary {
  const sheepHookId = opts.sheepHook ?? "r2s-ascending";
  const wolfHookId = opts.wolfHook ?? "wolf-call";
  const sheepHookText = hookSources[sheepHookId];
  const wolfHookText = hookSources[wolfHookId];
  if (!sheepHookText) throw new Error(`buildDefaultBedLibrary: unknown sheepHook "${sheepHookId}"`);
  if (!wolfHookText) throw new Error(`buildDefaultBedLibrary: unknown wolfHook "${wolfHookId}"`);

  const sources: BedSource[] = [];
  const knownBeds: ReadonlySet<string> = new Set([...SHEEP_BEDS, ...WOLF_BEDS]);
  for (const bed of SHEEP_BEDS) {
    const keys = findVariantKeys(bed, bedSources, knownBeds);
    if (keys.length === 0) throw new Error(`buildDefaultBedLibrary: missing source for bed "${bed}"`);
    for (const k of keys) {
      sources.push({ bed, text: bedSources[k], rootName: SHEEP_ROOT, beatsPerBar: BEATS_PER_BAR });
    }
  }
  for (const bed of WOLF_BEDS) {
    const keys = findVariantKeys(bed, bedSources, knownBeds);
    if (keys.length === 0) throw new Error(`buildDefaultBedLibrary: missing source for bed "${bed}"`);
    for (const k of keys) {
      sources.push({ bed, text: bedSources[k], rootName: WOLF_ROOT, beatsPerBar: BEATS_PER_BAR });
    }
  }

  return buildBedLibraryFromText(sheepHookText, sources, wolfHookText);
}

/** Stingers registered by default. id → (trigger, gain). The trigger string
 *  matches the GameEvent.type fired through fireGameEvent (round-end picks
 *  sheep-loss-fade vs rescue per winner internally). */
const DEFAULT_STINGERS: Record<string, { trigger: string; gain: number }> = {
  capture: { trigger: "capture", gain: 0.5 },
  rescue: { trigger: "rescue", gain: 0.6 },
  "sheep-loss-fade": { trigger: "round-end", gain: 0.6 },
};

/** Compile and register the canonical stinger set. Stingers without source
 *  text in the map are skipped silently — keeps the helper forgiving as the
 *  stinger catalogue grows. */
export function registerDefaultStingers(
  engine: V3EngineState,
  stingerSources: Record<string, string>,
): void {
  for (const [id, cfg] of Object.entries(DEFAULT_STINGERS)) {
    const text = stingerSources[id];
    if (!text) continue;
    let segment: Segment;
    try {
      segment = compileSegment(text);
    } catch (err) {
      console.warn(`registerDefaultStingers: failed to compile "${id}":`, err);
      continue;
    }
    registerStinger(engine, { id, trigger: cfg.trigger, segment, gain: cfg.gain });
  }
}
