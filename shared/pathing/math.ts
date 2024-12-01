import { SystemEntity } from "jsr:@verit/ecs";
import { Entity } from "../types.ts";

export type Point = { x: number; y: number };

export const polarProject = (
  point: Point,
  angle: number,
  distance: number,
): Point => ({
  x: point.x + Math.cos(angle) * distance,
  y: point.y + Math.sin(angle) * distance,
});

export const orientation = (p1: Point, p2: Point, p: Point): number =>
  (p.x - p1.x) * (p2.y - p1.y) - (p.y - p1.y) * (p2.x - p1.x);

export const behind = (
  leftTangent: Point,
  rightTangent: Point,
  x: number,
  y: number,
): boolean => orientation(leftTangent, rightTangent, { x, y }) < 0;

export const infront = (
  leftTangent: Point,
  rightTangent: Point,
  x: number,
  y: number,
): boolean => orientation(leftTangent, rightTangent, { x, y }) > 0;

export const trueMinX = (
  point: { x: number; y: number },
  radius: number,
  y: number,
  offValue: number,
): number => {
  if (Math.abs(point.y - y) - 0.5 <= 1) return offValue;

  if (y > point.y) {
    // Using the equation of the circle, but solving for the x coefficient
    const squared = -(point.y ** 2) + 2 * point.y * y + radius ** 2 - y ** 2;

    const core = Math.sign(squared) * Math.abs(squared) ** 0.5;

    return Math.floor(point.x - core);
  }

  const squared = -(point.y ** 2) + 2 * point.y * (y + 1) + radius ** 2 -
    (y + 1) ** 2;

  const core = Math.sign(squared) * Math.abs(squared) ** 0.5;

  return Math.floor(point.x - core);
};

export const trueMaxX = (
  point: Point,
  radius: number,
  y: number,
  offValue: number,
): number => {
  if (Math.abs(point.y - y) - 0.5 <= 1) return offValue;

  if (y > point.y) {
    const squared = -(point.y ** 2) + 2 * point.y * y + radius ** 2 - y ** 2;

    const core = Math.sign(squared) * Math.abs(squared) ** 0.5;

    return Math.floor(point.x + core);
  }

  const squared = -(point.y ** 2) + 2 * point.y * (y + 1) + radius ** 2 -
    (y + 1) ** 2;

  const core = Math.sign(squared) * Math.abs(squared) ** 0.5;

  return Math.floor(point.x + core);
};

export const offset = (
  point: Point,
  offset: number,
): Point => ({
  x: point.x + offset,
  y: point.y + offset,
});

export const squaredDistanceBetweenPoints = (a: Point, b: Point) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export const distanceBetweenPoints = (a: Point, b: Point) =>
  ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) ** 0.5;

type Unit = SystemEntity<Entity, "radius" | "position">;
const isUnit = (entity: Entity): entity is Unit =>
  typeof entity.radius === "number" && !!entity.position;

type Structure = SystemEntity<Entity, "tilemap" | "position">;
const isStructure = (entity: Entity): entity is Structure =>
  !!entity.tilemap && !!entity.position;

export const distanceBetweenEntities = (entityA: Entity, entityB: Entity) => {
  if (isUnit(entityA) && isUnit(entityB)) {
    return distanceBetweenUnits(entityA, entityB);
  }
  if (isUnit(entityA) && isStructure(entityB)) {
    return distanceBetweenUnitAndStructure(entityA, entityB);
  }
  if (isStructure(entityA) && isUnit(entityB)) {
    return distanceBetweenUnitAndStructure(entityB, entityA);
  }
  if (isStructure(entityA) && isStructure(entityB)) {
    return distanceBetweenStructures(entityA, entityB);
  }
  if (entityA.position && entityB.position) {
    return distanceBetweenPoints(entityA.position, entityB.position);
  }
  return Infinity;
};

const distanceBetweenUnits = (unitA: Unit, unitB: Unit) => {
  const dx = unitA.position.x - unitB.position.x;
  const dy = unitA.position.y - unitB.position.y;
  const centerDistance = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0, centerDistance - unitA.radius - unitB.radius);
};

const tileSize = 0.5; // Each tile represents 0.5 units in world space

const distanceBetweenUnitAndStructure = (unit: Unit, structure: Structure) => {
  let minDistance = Infinity;
  const { width, height, left, top, map } = structure.tilemap;

  // Calculate the origin (top-left corner) of the tilemap in world coordinates
  const tilemapOriginX = structure.position.x + left * tileSize;
  const tilemapOriginY = structure.position.y + top * tileSize;

  for (let i = 0; i < width * height; i++) {
    if (!map[i]) continue; // Only consider occupied tiles

    const col = i % width;
    const row = Math.floor(i / width);

    // Calculate the tile's position in world coordinates
    const tileMinX = tilemapOriginX + col * tileSize;
    const tileMinY = tilemapOriginY + row * tileSize;
    const tileMaxX = tileMinX + tileSize;
    const tileMaxY = tileMinY + tileSize;

    // Find the closest point on the tile to the unit's center
    const closestX = Math.max(tileMinX, Math.min(unit.position.x, tileMaxX));
    const closestY = Math.max(tileMinY, Math.min(unit.position.y, tileMaxY));

    // Calculate the distance from the unit's center to this closest point
    const dx = unit.position.x - closestX;
    const dy = unit.position.y - closestY;
    const distance = Math.sqrt(dx * dx + dy * dy) - unit.radius;

    minDistance = Math.min(minDistance, distance);
  }

  // If the minimum distance is negative or zero, the unit and structure touch or overlap
  return Math.max(0, minDistance);
};

const distanceBetweenStructures = (
  structureA: Structure,
  structureB: Structure,
) => {
  let minDistance = Infinity;
  for (
    let i = 0;
    i < structureA.tilemap.width * structureA.tilemap.height;
    i++
  ) {
    if (!structureA.tilemap.map[i]) continue;
    const tileAx = structureA.position.x + (structureA.tilemap.left +
          (i % structureA.tilemap.width)) / 2;
    const tileAy = structureA.position.y + (structureA.tilemap.top +
          Math.floor(i / structureA.tilemap.width)) / 2;
    for (
      let j = 0;
      j < structureB.tilemap.width * structureB.tilemap.height;
      j++
    ) {
      if (!structureB.tilemap.map[j]) continue;
      const tileBx = structureB.position.x + (structureB.tilemap.left +
            (j % structureB.tilemap.width)) / 2;
      const tileBy = structureB.position.y + (structureB.tilemap.top +
        Math.floor(j / structureB.tilemap.width) / 2);
      const dx = tileAx - tileBx;
      const dy = tileAy - tileBy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      minDistance = Math.min(minDistance, distance);
    }
  }

  return minDistance;
};
