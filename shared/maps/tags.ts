export const DEFAULT_MAP_TAGS = ["survival"] as const;

export type LobbyMode = "survival" | "vip" | "switch" | "vamp" | "bulldog";

/** Tags a map must have at least one of, given the lobby mode. Empty means any. */
export const requiredTagsForMode = (mode: LobbyMode): readonly string[] => {
  if (mode === "survival") return ["survival"];
  if (mode === "bulldog") return ["bulldog"];
  return [];
};

export const mapMatchesMode = (
  tags: readonly string[],
  mode: LobbyMode,
): boolean => {
  const required = requiredTagsForMode(mode);
  if (required.length === 0) return true;
  return required.some((tag) => tags.includes(tag));
};

export const PEN_TILE = 1;
export const START_TILE = 6;
export const END_TILE = 7;

/** Tracks per-tile counts that drive tag qualification. Only counts the tiles
 * that affect tags so the structure stays small. */
export type TagTileCounts = {
  pen: number;
  start: number;
  end: number;
};

export const emptyTagTileCounts = (): TagTileCounts => ({
  pen: 0,
  start: 0,
  end: 0,
});

const tagBucketForTile = (
  tile: number,
): keyof TagTileCounts | undefined => {
  if (tile === PEN_TILE) return "pen";
  if (tile === START_TILE) return "start";
  if (tile === END_TILE) return "end";
  return undefined;
};

export const countTagTiles = (tiles: number[][]): TagTileCounts => {
  const counts = emptyTagTileCounts();
  for (const row of tiles) {
    for (const tile of row) {
      const bucket = tagBucketForTile(tile);
      if (bucket) counts[bucket]++;
    }
  }
  return counts;
};

export const applyTagTileChange = (
  counts: TagTileCounts,
  oldTile: number,
  newTile: number,
): boolean => {
  if (oldTile === newTile) return false;
  const oldBucket = tagBucketForTile(oldTile);
  const newBucket = tagBucketForTile(newTile);
  if (!oldBucket && !newBucket) return false;
  if (oldBucket) counts[oldBucket]--;
  if (newBucket) counts[newBucket]++;
  return true;
};

export const tagsFromCounts = (counts: TagTileCounts): string[] => {
  const tags: string[] = [];
  if (counts.pen > 0) tags.push("survival");
  if (counts.start > 0 && counts.end > 0) tags.push("bulldog");
  return tags;
};

export const generateMapTags = (tiles: number[][]): string[] =>
  tagsFromCounts(countTagTiles(tiles));
