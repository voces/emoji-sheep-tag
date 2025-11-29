import { tileDefs } from "@/shared/data.ts";

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
      return tileDefs[tileIndex].pathing | (cliffMap[y][x] ? 3 : 0);
    })
  );
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
