import { Entity, SystemEntity } from "../types.ts";
import { facingWithin } from "../../server/util/math.ts";
import { MAX_ATTACK_ANGLE } from "../constants.ts";
import { PathingMap } from "./PathingMap.ts";
import { tiles } from "../map.ts";
import { Footprint } from "./types.ts";

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

type Unit = SystemEntity<"radius" | "position">;

export const distanceBetweenEntities = (entityA: Entity, entityB: Entity) => {
  if (!entityA.position || !entityB.position) return Infinity;

  const aPoints = entityPoints(entityA);
  if (!aPoints.length) return Infinity;

  const bPoints = entityPoints(entityB);
  if (!bPoints.length) return Infinity;

  let min = Infinity;
  for (const a of aPoints) {
    for (const b of bPoints) {
      const d = ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) ** 0.5;
      if (d < min) min = d;
    }
  }

  return min;
};

export const distanceToPoint = (entity: Entity, point: Point) => {
  if (!entity.position) return Infinity;
  const points = entityPoints(entity);
  if (!points.length) return Infinity;

  let min = Infinity;
  for (const p of points) {
    const d = ((p.x - point.x) ** 2 + (p.y - point.y) ** 2) ** 0.5;
    if (d < min) min = d;
  }

  return min;
};

let pm: PathingMap;
const unitToTilemap = (unit: Unit) => {
  if (!pm) {
    pm = new PathingMap({
      resolution: 4,
      pathing: tiles.reverse(),
    });
  }
  return pm.pointToTilemap(unit.position.x, unit.position.y, unit.radius, {
    type: unit.pathing,
    includeOutOfBounds: true,
  });
};

export const entityPoints = (entity: Entity) => {
  if (!entity.position) return [];
  if (entity.tilemap) {
    const p = footprintPoints(entity.tilemap, entity.position);
    return p.length ? p : [entity.position];
  }
  if (entity.radius) {
    const p = footprintPoints(unitToTilemap(entity as Unit), entity.position);
    return p.length ? p : [entity.position];
  }
  return [entity.position];
};

const tileSize = 0.25; // Each tile represents 0.25 units in world space

const footprintPoints = (footprint: Footprint, position: Point) => {
  if (!pm) {
    pm = new PathingMap({
      resolution: 4,
      pathing: tiles.reverse(),
    });
  }

  const points: Point[] = [];

  const { width, height, left, top, map } = footprint;

  // Calculate the origin (top-left corner) of the tilemap in world coordinates
  const tilemapOriginX = pm.xTileToWorld(pm.xWorldToTile(position.x)) +
    left * tileSize;
  const tilemapOriginY = pm.yTileToWorld(pm.yWorldToTile(position.y)) +
    top * tileSize;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!map[y * width + x]) continue;
      // Top left; could have been included by left, above, or left-and-above
      if (
        (y === 0 || !map[(y - 1) * width + x]) &&
        (y === 0 || x === 0 || !map[(y - 1) * width + x - 1]) &&
        (x === 0 || !map[y * width + x - 1])
      ) {
        points.push({
          x: x * tileSize + tilemapOriginX,
          y: y * tileSize + tilemapOriginY,
        });
      }
      // Top right; could have only been included by above
      if (y === 0 || !map[(y - 1) * width + x]) {
        points.push({
          x: x * tileSize + tilemapOriginX + tileSize,
          y: y * tileSize + tilemapOriginY,
        });
      }
      // Bottom right; could not have been included by any previous iteration
      points.push({
        x: x * tileSize + tilemapOriginX + tileSize,
        y: y * tileSize + tilemapOriginY + tileSize,
      });
      // Bottom left; could have only been included by left
      if (x === 0 || !map[y * width + x - 1]) {
        points.push({
          x: x * tileSize + tilemapOriginX,
          y: y * tileSize + tilemapOriginY + tileSize,
        });
      }
    }
  }

  return points;
};

/** Normalizes an angle to the range (-π, π]. */
export const normalizeAngle = (angle: number): number => {
  angle = angle % (2 * Math.PI);
  if (angle > Math.PI) angle -= 2 * Math.PI;
  if (angle <= -Math.PI) angle += 2 * Math.PI;
  return angle;
};

/** Computes the smallest difference between two angles, returning a value in (-π, π]. */
export const angleDifference = (a: number, b: number): number =>
  normalizeAngle(b - a);

export const tweenAbsAngles = (a: number, b: number, delta: number) => {
  const TWO_PI = Math.PI * 2;

  // Normalize angles into [0, 2π)
  let A = a % TWO_PI;
  let B = b % TWO_PI;
  if (A < 0) A += TWO_PI;
  if (B < 0) B += TWO_PI;

  // Find the shortest difference
  let diff = B - A;
  if (diff > Math.PI) {
    diff -= TWO_PI;
  } else if (diff < -Math.PI) {
    diff += TWO_PI;
  }

  // If delta is large enough to overshoot, just return B
  if (Math.abs(diff) <= delta) {
    return B;
  }

  // Move closer to B by delta
  if (diff > 0) {
    return (A + delta) % TWO_PI;
  } else {
    // diff < 0
    return (A - delta + TWO_PI) % TWO_PI;
  }
};

/** Checks if an entity is within range of another entity or point. */
export const withinRange = (
  mover: Entity,
  target: Entity | Point,
  range: number,
) => {
  if (!mover.position) return false;
  const targetPoint = "id" in target ? target.position : target;
  if (!targetPoint) return;

  const targetEntity = "id" in target ? target : undefined;

  const distance = targetEntity
    ? distanceBetweenEntities(mover, targetEntity)
    // Kind of a hack, but trying to use distanceToPoint for building makes the
    // unit run around... Need a fix, but then pathing needs to be aware of
    // distanceToPoint
    : (mover.order?.type === "build" ||
        (mover.order?.type === "walk" && mover.queue?.[0]?.type === "build"))
    ? distanceBetweenPoints(mover.position, targetPoint)
    : distanceToPoint(mover, targetPoint);

  return distance <= range;
};

/**
 * Checks if an entity can attack another entity, taking into account attack
 * range and facing angle.
 */
export const canSwing = (
  attacker: Entity,
  target: Entity,
  skipFacingCheck = false,
) => {
  if (!attacker.position || !attacker.attack || !target.position) return false;

  const distance = distanceBetweenEntities(attacker, target);

  if (distance > attacker.attack?.range) return false;

  if (
    !skipFacingCheck &&
    attacker.turnSpeed &&
    !facingWithin(attacker, target.position, MAX_ATTACK_ANGLE)
  ) {
    return false;
  }

  return true;
};
