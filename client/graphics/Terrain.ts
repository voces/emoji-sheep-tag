import { BufferGeometry, Mesh, MeshBasicMaterial } from "three";
import { tiles as tileTypes } from "@/shared/data.ts";

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
) => {
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
        if (firstNonRampNeighborHeight !== tile) return 3;
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
    ) return 3;
  }

  // Otherwise it is pathable
  return 0;
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

export class Terrain extends Mesh {
  pathingMap: number[][];

  constructor(tiles: string, cliffs: string) {
    const parsedTiles = double(
      tiles.split("\n").map((r) => r.split("").map((v) => parseInt(v))),
    );
    const parsedCliffs = double(
      cliffs.split("\n").map((r) =>
        r.split("").map((v) => v === "r" ? v : parseInt(v))
      ),
    );

    const pathingMap = parsedTiles.map((r, y) =>
      r.map((tileIndex, x) => {
        const cliffPathing = getCliffFlag(parsedCliffs, x, y);
        const isCliff = cliffPathing > 0;
        return tileTypes[tileIndex].pathing | cliffPathing;
      })
    );

    super(new BufferGeometry(), new MeshBasicMaterial());

    this.pathingMap = pathingMap;
  }
}
