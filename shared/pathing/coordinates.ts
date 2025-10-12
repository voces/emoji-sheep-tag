import { PATHING_TYPES } from "./constants.ts";
import { Footprint } from "./types.ts";

const EPSILON = Number.EPSILON * 100;

/**
 * Coordinate conversion utilities that don't require a full PathingMap instance.
 * These are pure math functions based on resolution parameters.
 */

export const xWorldToTile = (x: number, resolution: number): number =>
  Math.floor(x * resolution);

export const yWorldToTile = (y: number, resolution: number): number =>
  Math.floor(y * resolution);

export const xTileToWorld = (x: number, resolution: number): number =>
  x / resolution;

export const yTileToWorld = (y: number, resolution: number): number =>
  y / resolution;

/**
 * Calculates a tilemap/footprint required to place something at `(xWorld,
 * yWorld)` with `radius`.
 */
export const pointToTilemap = (
  xWorld: number,
  yWorld: number,
  radius: number,
  resolution: number,
  widthWorld: number,
  { type = PATHING_TYPES.WALKABLE } = {},
): Footprint => {
  radius -= EPSILON * radius * widthWorld;

  const xTile = xWorldToTile(xWorld, resolution);
  const yTile = yWorldToTile(yWorld, resolution);

  const map = [];

  const xMiss = xTile / resolution - xWorld;
  const yMiss = yTile / resolution - yWorld;

  const minX = xWorldToTile(xWorld - radius, resolution) - xTile;
  const maxX = xWorldToTile(xWorld + radius, resolution) - xTile;
  const minY = yWorldToTile(yWorld - radius, resolution) - yTile;
  const maxY = yWorldToTile(yWorld + radius, resolution) - yTile;

  const radiusSquared = radius ** 2;

  for (let tY = minY; tY <= maxY; tY++) {
    for (let tX = minX; tX <= maxX; tX++) {
      const yDelta = tY < 0
        ? (tY + 1) / resolution + yMiss
        : tY > 0
        ? tY / resolution + yMiss
        : 0;

      const xDelta = tX < 0
        ? (tX + 1) / resolution + xMiss
        : tX > 0
        ? tX / resolution + xMiss
        : 0;

      const distanceSquared = xDelta ** 2 + yDelta ** 2;

      if (distanceSquared < radiusSquared) map.push(type);
      else map.push(0);
    }
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    map,
  };
};
