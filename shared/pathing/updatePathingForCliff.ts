import {
  getCliffHeight,
  getPathingMaskFromTerrainMasks,
} from "./terrainHelpers.ts";
import type { PathingMap } from "./PathingMap.ts";

type Bounds = { min: { x: number; y: number }; max: { x: number; y: number } };

/**
 * Apply a precomputed pathing/layers snapshot to a 5x5 tile patch around each
 * changed cell. Caller is responsible for computing newPathing/newLayers from
 * current terrain state — this is the part that's worth sharing across many
 * cell edits in one batch.
 *
 * Iterates the bounding box of the affected 5x5 patches directly (clamped to
 * the map). For contiguous brushes that's exactly the union, so we avoid the
 * per-cell dedup Set and the per-cell bounds checks entirely.
 */
const applyPatchedPathing = (
  pathingMap: PathingMap,
  newPathing: number[][],
  newLayers: number[][] | undefined,
  cells: ReadonlyArray<readonly [number, number]>,
) => {
  const height = newPathing.length;
  const width = newPathing[0]?.length ?? 0;
  if (width === 0 || height === 0) return;

  const tilesPerPathingCell = pathingMap.resolution / pathingMap.tileResolution;
  const res = pathingMap.tileResolution;

  let minTileX = Infinity;
  let maxTileX = -Infinity;
  let minTileY = Infinity;
  let maxTileY = -Infinity;
  for (const [worldX, worldY] of cells) {
    const tx = Math.floor(worldX);
    const ty = Math.floor(worldY);
    if (tx < minTileX) minTileX = tx;
    if (tx > maxTileX) maxTileX = tx;
    if (ty < minTileY) minTileY = ty;
    if (ty > maxTileY) maxTileY = ty;
  }

  const startPX = Math.max(0, (minTileX - 2) * res);
  const endPX = Math.min(width - 1, (maxTileX + 2) * res + (res - 1));
  const startPY = Math.max(0, (minTileY - 2) * res);
  const endPY = Math.min(height - 1, (maxTileY + 2) * res + (res - 1));

  for (let pathingY = startPY; pathingY <= endPY; pathingY++) {
    const mapY = height - 1 - pathingY;
    const pathingRow = newPathing[mapY];
    const layerRow = newLayers?.[mapY];
    const layersOut = pathingMap.layers?.[pathingY];
    for (let pathingX = startPX; pathingX <= endPX; pathingX++) {
      const pathing = pathingRow[pathingX];
      if (layersOut && layerRow) layersOut[pathingX] = layerRow[pathingX];
      const gridX = pathingX * tilesPerPathingCell;
      const gridY = pathingY * tilesPerPathingCell;
      for (let gy = gridY; gy < gridY + tilesPerPathingCell; gy++) {
        for (let gx = gridX; gx < gridX + tilesPerPathingCell; gx++) {
          // @ts-ignore - getTile is private but we need direct access
          const tile = pathingMap.getTile(gx, gy);
          if (tile) {
            tile.originalPathing = pathing;
            tile.recalculatePathing();
          }
        }
      }
    }
  }
};

/**
 * Bulk variant of updatePathingForCliff: computes the new pathing/layers
 * snapshot once, then patches the union of 5x5 tile areas around each changed
 * cell. Use this for batched cliff/water edits to avoid an O(N * map_area)
 * blowup from per-cell full-map recomputes.
 */
export const updatePathingForCliffs = (
  pathingMap: PathingMap,
  tiles: number[][],
  cliffs: (number | "r")[][],
  water: number[][],
  cells: ReadonlyArray<readonly [number, number]>,
  bounds?: Bounds,
) => {
  if (cells.length === 0) return;
  const newPathing = getPathingMaskFromTerrainMasks(
    tiles,
    cliffs,
    water,
    bounds,
  );
  const newLayers = pathingMap.layers
    ? newPathing.map((r, y) =>
      r.map((_, x) => Math.floor(getCliffHeight(x, y, cliffs)))
    )
    : undefined;
  applyPatchedPathing(pathingMap, newPathing, newLayers, cells);
};

/**
 * Updates a PathingMap after a single cliff terrain change by recomputing
 * pathing and cliff heights for a 5x5 area of world tiles around the changed
 * location. For batched edits prefer updatePathingForCliffs to avoid repeated
 * full-map recomputes.
 */
export const updatePathingForCliff = (
  pathingMap: PathingMap,
  tiles: number[][],
  cliffs: (number | "r")[][],
  water: number[][],
  worldX: number,
  worldY: number,
  bounds?: Bounds,
) =>
  updatePathingForCliffs(
    pathingMap,
    tiles,
    cliffs,
    water,
    [[worldX, worldY]],
    bounds,
  );
