import {
  applyTagTileChange,
  countTagTiles,
  emptyTagTileCounts,
  tagsFromCounts,
  type TagTileCounts,
} from "@/shared/maps/tags.ts";
import { editorMapTagsVar } from "@/vars/editor.ts";
import { onMapChange } from "@/shared/map.ts";

let counts: TagTileCounts = emptyTagTileCounts();

const publish = () => editorMapTagsVar(tagsFromCounts(counts));

export const recordTileChange = (oldTile: number, newTile: number) => {
  if (applyTagTileChange(counts, oldTile, newTile)) publish();
};

export const recordBulkTileChanges = (
  changes: Iterable<readonly [number, number]>,
) => {
  let mutated = false;
  for (const [oldTile, newTile] of changes) {
    if (applyTagTileChange(counts, oldTile, newTile)) mutated = true;
  }
  if (mutated) publish();
};

onMapChange((map) => {
  counts = countTagTiles(map.tiles);
  publish();
});
