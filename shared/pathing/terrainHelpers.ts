import { tileDefs } from "@/shared/data.ts";

const neighbors = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

const getCliffFlag = (
  cliffs: (number | "r")[][],
  x: number,
  y: number,
): boolean => {
  const cur = cliffs[y][x];
  let rampNeighbors = 0;
  let firstNonRampNeighborHeight: number | undefined;
  let firstDiagRamp: { x: number; y: number } | undefined;

  for (const neighbor of neighbors) {
    const tile = cliffs[y + neighbor.y]?.[x + neighbor.x];

    // Edges are ???
    if (tile === undefined) continue;

    if (tile !== "r") {
      if (firstNonRampNeighborHeight !== undefined) {
        // Cliff changes are not pathable
        if (firstNonRampNeighborHeight !== tile) return true;
      } else firstNonRampNeighborHeight = tile;
    } else {
      rampNeighbors++;
      // diag
      if (neighbor.x !== 0 && neighbor.y !== 0) firstDiagRamp = neighbor;
    }
  }

  if (
    // 1 ramp means we're flat and a ramp is diag
    rampNeighbors === 1 ||
    // 2 ramps mean we're flat and a ramp is adj+diag
    rampNeighbors === 2 ||
    // 3 ramps + we're ramp means we're a corner ramp
    (cur === "r" && rampNeighbors === 3)
  ) {
    if (
      cliffs[y + firstDiagRamp!.y]?.[x + firstDiagRamp!.x * 3] !== "r" ||
      cliffs[y + firstDiagRamp!.y * 3]?.[x + firstDiagRamp!.x] !== "r"
    ) return true;
  }

  // Otherwise it is pathable
  return false;
};

// Turns [[x]] into [[x, x], [x, x]]
const double = <T>(arr: T[][]): T[][] => {
  const newArr: T[][] = [];

  for (const row of arr) {
    const newRow: T[] = [];
    for (const value of row) newRow.push(value, value);
    newArr.push(newRow, [...newRow]);
  }

  return newArr;
};

export const getCliffMapFromCliffMask = (cliffMask: (number | "r")[][]) => {
  const parsedCliffs = double(cliffMask);
  return parsedCliffs.map((r, y) =>
    r.map((_, x) => getCliffFlag(parsedCliffs, x, y))
  );
};

export const getPathingMaskFromTerrainMasks = (
  tileMask: number[][],
  cliffMask: (number | "r")[][],
  bounds?: { min: { x: number; y: number }; max: { x: number; y: number } },
) => {
  const parsedTiles = double(tileMask);
  const cliffMap = getCliffMapFromCliffMask(cliffMask);

  return parsedTiles.map((r, y) =>
    r.map((tileIndex, x) => {
      // Check if outside bounds - treat as fully blocked (0xFF)
      if (bounds) {
        const worldX = x / 2; // tileResolution is 2
        const worldY = (parsedTiles.length - 1 - y) / 2;
        if (
          worldX < bounds.min.x || worldX >= bounds.max.x ||
          worldY < bounds.min.y || worldY >= bounds.max.y
        ) {
          return 0xFF;
        }
      }

      try {
        return tileDefs[tileIndex].pathing | (cliffMap[y]?.[x] ? 3 : 0);
      } catch (err) {
        console.log(tileIndex);
        throw err;
      }
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
