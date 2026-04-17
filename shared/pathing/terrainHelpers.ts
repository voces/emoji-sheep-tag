import { tileDefs } from "@/shared/data.ts";
import {
  PATHING_BUILDABLE,
  PATHING_WALKABLE,
  WATER_DEEP_DEPTH,
  WATER_LEVEL_SCALE,
} from "@/shared/constants.ts";

// Neighbor offsets as flat arrays for faster iteration (dx, dy pairs)
// Diagonals first (indices 0-3), then cardinals (indices 4-7)
const neighborDx = [-1, 1, -1, 1, 0, -1, 1, 0];
const neighborDy = [-1, -1, 1, 1, -1, 0, 0, 1];

const getCliffFlag = (
  cliffs: (number | "r")[][],
  x: number,
  y: number,
): boolean => {
  const cur = cliffs[y][x];
  let rampNeighbors = 0;
  let firstNonRampNeighborHeight: number | undefined;
  let firstDiagDx = 0;
  let firstDiagDy = 0;

  for (let i = 0; i < 8; i++) {
    const dx = neighborDx[i];
    const dy = neighborDy[i];
    const tile = cliffs[y + dy]?.[x + dx];

    if (tile === undefined) continue;

    if (tile !== "r") {
      if (firstNonRampNeighborHeight !== undefined) {
        if (firstNonRampNeighborHeight !== tile) return true;
      } else firstNonRampNeighborHeight = tile;
    } else {
      rampNeighbors++;
      // diag (first 4 indices are diagonals)
      if (i < 4) {
        firstDiagDx = dx;
        firstDiagDy = dy;
      }
    }
  }

  if (
    rampNeighbors === 1 ||
    rampNeighbors === 2 ||
    (cur === "r" && rampNeighbors === 3)
  ) {
    if (
      cliffs[y + firstDiagDy]?.[x + firstDiagDx * 3] !== "r" ||
      cliffs[y + firstDiagDy * 3]?.[x + firstDiagDx] !== "r"
    ) return true;
  }

  return false;
};

// Turns [[x]] into [[x, x], [x, x]]
const double = <T>(arr: T[][]): T[][] =>
  arr.flatMap((row) => {
    const r = row.flatMap((v) => [v, v]);
    return [r, r];
  });

export const getCliffMapFromCliffMask = (cliffMask: (number | "r")[][]) =>
  double(cliffMask).map((row, y, parsedCliffs) =>
    row.map((_, x) => getCliffFlag(parsedCliffs, x, y))
  );

export const getPathingMaskFromTerrainMasks = (
  tileMask: number[][],
  cliffMask: (number | "r")[][],
  waterMask?: number[][],
  bounds?: { min: { x: number; y: number }; max: { x: number; y: number } },
) => {
  const parsedTiles = double(tileMask);
  const cliffMap = getCliffMapFromCliffMask(cliffMask);

  return parsedTiles.map((tileRow, y) =>
    tileRow.map((tileIndex, x) => {
      if (bounds) {
        const worldX = x / 2;
        const worldY = (parsedTiles.length - 1 - y) / 2;
        if (
          worldX < bounds.min.x || worldX >= bounds.max.x ||
          worldY < bounds.min.y || worldY >= bounds.max.y
        ) return 0xFF;
      }
      let pathing = tileDefs[tileIndex].pathing | (cliffMap[y][x] ? 3 : 0);
      if (waterMask) {
        const depth = getWaterDepth(x, y, cliffMask, waterMask);
        if (depth > 0) {
          pathing |= PATHING_BUILDABLE;
          if (depth >= WATER_DEEP_DEPTH) pathing |= PATHING_WALKABLE;
        }
      }
      return pathing;
    })
  );
};

/** Returns the water level (in cliff units) at a doubled-grid coordinate. 0 = no water. */
export const getWaterLevel = (
  checkX: number,
  checkY: number,
  waterMask: number[][],
): number => {
  const tileY = Math.min(Math.floor(checkY / 2), waterMask.length - 1);
  const row = waterMask[tileY];
  if (!row) return 0;
  const tileX = Math.min(Math.floor(checkX / 2), row.length - 1);
  return (row[tileX] ?? 0) / WATER_LEVEL_SCALE;
};

/** Water depth = waterLevel - cliffHeight, clamped to >= 0 if dry. */
export const getWaterDepth = (
  checkX: number,
  checkY: number,
  cliffMask: (number | "r")[][],
  waterMask: number[][],
): number => {
  const water = getWaterLevel(checkX, checkY, waterMask);
  if (water <= 0) return 0;
  const height = getCliffHeight(checkX, checkY, cliffMask);
  return water - height;
};

/**
 * Water depth at a world-space position (y=0 at bottom, y increases upward).
 * Bilinearly samples the 4 neighboring doubled-grid cells so depth varies
 * smoothly across cliff and shore boundaries, matching the terrain shader's
 * linear-filtered water texture. The 0.5 offsets center the sample on
 * doubled-grid texel centers so the interpolation band straddles each cell
 * boundary symmetrically — otherwise ramps look deeper on one side.
 */
export const getWaterDepthAtWorld = (
  worldX: number,
  worldY: number,
  cliffMask: (number | "r")[][],
  waterMask: number[][],
): number => {
  const maxX = (cliffMask[0]?.length ?? 0) * 2 - 1;
  const maxY = cliffMask.length * 2 - 1;
  const gxf = worldX * 2 - 0.5;
  const gyf = cliffMask.length * 2 - 0.5 - worldY * 2;
  const gx0 = Math.floor(gxf);
  const gy0 = Math.floor(gyf);
  const fx = gxf - gx0;
  const fy = gyf - gy0;

  const clamp = (v: number, hi: number) => Math.max(0, Math.min(hi, v));
  const sample = (ix: number, iy: number) =>
    getWaterDepth(clamp(ix, maxX), clamp(iy, maxY), cliffMask, waterMask);
  const d00 = sample(gx0, gy0);
  const d10 = sample(gx0 + 1, gy0);
  const d01 = sample(gx0, gy0 + 1);
  const d11 = sample(gx0 + 1, gy0 + 1);

  return (d00 * (1 - fx) + d10 * fx) * (1 - fy) +
    (d01 * (1 - fx) + d11 * fx) * fy;
};

export const getCliffHeight = (
  checkX: number,
  checkY: number,
  cliffMask: (number | "r")[][],
): number => {
  const tileY = Math.min(Math.floor(checkY / 2), cliffMask.length - 1);
  const tileX = Math.min(Math.floor(checkX / 2), cliffMask[tileY].length - 1);
  const maskValue = cliffMask[tileY]?.[tileX];

  if (typeof maskValue === "number") return maskValue;

  if (maskValue === "r") {
    const adjacent = [
      cliffMask[tileY - 1]?.[tileX],
      cliffMask[tileY + 1]?.[tileX],
      cliffMask[tileY]?.[tileX - 1],
      cliffMask[tileY]?.[tileX + 1],
    ].filter((val): val is number => typeof val === "number");

    if (adjacent.length > 0) {
      const min = Math.min(...adjacent);
      const max = Math.max(...adjacent);
      return (min + max) / 2;
    }
  }

  return 0;
};
