import manifest from "./manifest.json" with { type: "json" };

export type MapManifestEntry = {
  /** Unique identifier; also the JSON filename stem under shared/maps. */
  id: string;
  /** Display name shown in lobby UI */
  name: string;
  /** Search tags. Defaults to ["survival"] when omitted. */
  tags?: readonly string[];
};

export const MAPS: readonly MapManifestEntry[] = manifest;

export const getMapMeta = (id: string) => MAPS.find((map) => map.id === id);

export const getMapManifestTags = (
  entry: MapManifestEntry,
): readonly string[] => entry.tags?.length ? entry.tags : ["survival"];
