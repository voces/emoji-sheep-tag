export type MapManifestEntry = {
  /** Unique identifier (used across network messages) */
  id: string;
  /** Display name shown in lobby UI */
  name: string;
  /** Relative filename (without extension) found under shared/maps */
  file: string;
  /** Optional description or flavor text */
  description?: string;
  /** Search tags. Defaults to ["survival"] when omitted. */
  tags?: readonly string[];
};

export const MAPS: readonly MapManifestEntry[] = [{
  id: "revo",
  name: "Revolution",
  file: "revo",
}, {
  id: "compact",
  name: "Compact",
  file: "compact",
}, {
  id: "ultimate",
  name: "Ultimate",
  file: "ultimate",
}, {
  id: "theFarm",
  name: "The Farm",
  file: "theFarm",
  tags: ["bulldog"],
}, {
  id: "theRock",
  name: "The Rock",
  file: "theRock",
  tags: ["bulldog"],
}] as const;

export const getMapMeta = (id: string) => MAPS.find((map) => map.id === id);

export const getMapManifestTags = (
  entry: MapManifestEntry,
): readonly string[] => entry.tags?.length ? entry.tags : ["survival"];
