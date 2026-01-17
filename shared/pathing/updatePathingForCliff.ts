import {
  getCliffHeight,
  getPathingMaskFromTerrainMasks,
} from "./terrainHelpers.ts";
import type { PathingMap } from "./PathingMap.ts";

/**
 * Updates a PathingMap after cliff terrain changes by recomputing pathing
 * and cliff heights for a 5x5 area of world tiles around the changed location.
 */
export const updatePathingForCliff = (
  pathingMap: PathingMap,
  tiles: number[][],
  cliffs: (number | "r")[][],
  worldX: number,
  worldY: number,
  bounds?: { min: { x: number; y: number }; max: { x: number; y: number } },
) => {
  // Recompute pathing from terrain (with bounds to mark out-of-bounds as impassable)
  const newPathing = getPathingMaskFromTerrainMasks(tiles, cliffs, bounds);

  // Recompute cliff heights if layers are being used
  const newLayers = pathingMap.layers
    ? newPathing.map((r, y) =>
      r.map((_, x) => Math.floor(getCliffHeight(x, y, cliffs)))
    )
    : undefined;

  const tileX = Math.floor(worldX);
  const tileY = Math.floor(worldY);
  const tilesPerPathingCell = pathingMap.resolution / pathingMap.tileResolution;

  // Update pathing for a 5x5 tile area around the changed tile
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const tx = tileX + dx;
      const ty = tileY + dy;

      // Each world tile corresponds to a tileResolution x tileResolution block in the pathing array
      for (let py = 0; py < pathingMap.tileResolution; py++) {
        for (let px = 0; px < pathingMap.tileResolution; px++) {
          const pathingX = tx * pathingMap.tileResolution + px;
          const pathingY = ty * pathingMap.tileResolution + py;

          // newPathing is in map coordinates (y=0 is top), convert to access it
          const mapY = newPathing.length - 1 - pathingY;

          if (newPathing[mapY]?.[pathingX] !== undefined) {
            const pathing = newPathing[mapY][pathingX];
            const gridX = pathingX * tilesPerPathingCell;
            const gridY = pathingY * tilesPerPathingCell;

            // Update layers if available
            if (pathingMap.layers && newLayers) {
              pathingMap.layers[pathingY][pathingX] = newLayers[mapY][pathingX];
            }

            // Update the grid tiles for this pathing cell
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
      }
    }
  }
};
