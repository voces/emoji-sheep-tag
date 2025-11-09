export type MapManifestEntry = {
  /** Unique identifier (used across network messages) */
  id: string;
  /** Display name shown in lobby UI */
  name: string;
  /** Relative filename (without extension) found under shared/maps */
  file: string;
  /** Optional description or flavor text */
  description?: string;
};

export const MAPS: readonly MapManifestEntry[] = [{
  id: "revo",
  name: "Revolution",
  file: "revo",
  description: "Classic Sheep Tag layout with central farms.",
}] as const;

export const getMapMeta = (id: string) => MAPS.find((map) => map.id === id);
