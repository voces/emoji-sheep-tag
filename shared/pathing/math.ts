import { Entity, SystemEntity } from "../types.ts";
import { facingWithin } from "../../server/util/math.ts";
import { MAX_ATTACK_ANGLE } from "../constants.ts";
import { Footprint } from "./types.ts";
import {
  pointToTilemap as calculateTilemap,
  xTileToWorld,
  xWorldToTile,
  yTileToWorld,
  yWorldToTile,
} from "./coordinates.ts";

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

export const distanceBetweenEntities = (
  entityA: Entity,
  entityB: Entity,
  max?: number,
) => {
  if (!entityA.position || !entityB.position) return Infinity;

  if (max !== undefined && entityA.radius && entityB.radius) {
    const cdx = entityA.position.x - entityB.position.x;
    const cdy = entityA.position.y - entityB.position.y;
    const centerDist = (cdx * cdx + cdy * cdy) ** 0.5;
    if (centerDist - entityA.radius - entityB.radius > max + 1) return Infinity;
  }

  const aPoints = entityPoints(entityA);
  if (!aPoints.length) return Infinity;

  const bPoints = entityPoints(entityB);
  if (!bPoints.length) return Infinity;

  const aLen = aPoints.length;
  const bLen = bPoints.length;

  let minSq = Infinity;
  for (let i = 0; i < aLen; i += 2) {
    const ax = aPoints[i];
    const ay = aPoints[i + 1];
    for (let j = 0; j < bLen; j += 2) {
      const dx = ax - bPoints[j];
      const dxSq = dx * dx;
      if (dxSq >= minSq) continue;
      const dy = ay - bPoints[j + 1];
      const dSq = dxSq + dy * dy;
      if (dSq < minSq) minSq = dSq;
    }
  }

  return minSq ** 0.5;
};

export const distanceToPoint = (entity: Entity, point: Point) => {
  if (!entity.position) return Infinity;
  const points = entityPoints(entity);
  if (!points.length) return Infinity;

  const px = point.x;
  const py = point.y;
  let minSq = Infinity;
  for (let i = 0; i < points.length; i += 2) {
    const dx = points[i] - px;
    const dxSq = dx * dx;
    if (dxSq >= minSq) continue;
    const dy = points[i + 1] - py;
    const dSq = dxSq + dy * dy;
    if (dSq < minSq) minSq = dSq;
  }

  return minSq ** 0.5;
};

// Constants matching the PathingMap configuration
const RESOLUTION = 4;
const WORLD_WIDTH = 96; // 96x96 world

const unitToTilemap = (unit: Unit) =>
  calculateTilemap(
    unit.position.x,
    unit.position.y,
    unit.radius,
    RESOLUTION,
    WORLD_WIDTH,
    { type: unit.pathing },
  );

// Tier 1: grid-aligned positions produce identical footprint shapes per radius.
// Cache relative offsets as flat [dx0, dy0, dx1, dy1, ...] keyed by radius.
const gridRelativeCache = new Map<number, number[]>();

const getGridRelativeFlat = (entity: Unit): number[] => {
  const cached = gridRelativeCache.get(entity.radius);
  if (cached) return cached;
  const tilemap = unitToTilemap(entity);
  const pts = footprintPointsFlat(tilemap, entity.position);
  const ox = xTileToWorld(
    xWorldToTile(entity.position.x, RESOLUTION),
    RESOLUTION,
  );
  const oy = yTileToWorld(
    yWorldToTile(entity.position.y, RESOLUTION),
    RESOLUTION,
  );
  const relative = new Array<number>(pts.length);
  for (let i = 0; i < pts.length; i += 2) {
    relative[i] = pts[i] - ox;
    relative[i + 1] = pts[i + 1] - oy;
  }
  gridRelativeCache.set(entity.radius, relative);
  return relative;
};

// Structure tilemap cache: referentially identical tilemaps share relative offsets.
const structureRelativeCache = new Map<Footprint, number[]>();

// Tier 2: per-entity cache for non-grid-aligned positions
type EntityPointsCache = { x: number; y: number; points: number[] };
const entityCache = new WeakMap<Entity, EntityPointsCache>();

const EMPTY: number[] = [];

export const entityPoints = (entity: Entity): number[] => {
  if (!entity.position) return EMPTY;
  if (entity.tilemap) {
    let relative = structureRelativeCache.get(entity.tilemap);
    if (!relative) {
      const pts = footprintPointsFlat(entity.tilemap, entity.position);
      const ox = xTileToWorld(
        xWorldToTile(entity.position.x, RESOLUTION),
        RESOLUTION,
      );
      const oy = yTileToWorld(
        yWorldToTile(entity.position.y, RESOLUTION),
        RESOLUTION,
      );
      relative = new Array<number>(pts.length);
      for (let i = 0; i < pts.length; i += 2) {
        relative[i] = pts[i] - ox;
        relative[i + 1] = pts[i + 1] - oy;
      }
      structureRelativeCache.set(entity.tilemap, relative);
    }
    if (!relative.length) return [entity.position.x, entity.position.y];
    const ox = xTileToWorld(
      xWorldToTile(entity.position.x, RESOLUTION),
      RESOLUTION,
    );
    const oy = yTileToWorld(
      yWorldToTile(entity.position.y, RESOLUTION),
      RESOLUTION,
    );
    const result = new Array<number>(relative.length);
    for (let i = 0; i < relative.length; i += 2) {
      result[i] = relative[i] + ox;
      result[i + 1] = relative[i + 1] + oy;
    }
    return result;
  }
  if (entity.radius) {
    const { x, y } = entity.position;
    const xTile = xWorldToTile(x, RESOLUTION);
    const yTile = yWorldToTile(y, RESOLUTION);
    const isGridAligned = Math.abs(x * RESOLUTION - xTile) < 1e-9 &&
      Math.abs(y * RESOLUTION - yTile) < 1e-9;

    if (isGridAligned) {
      const relative = getGridRelativeFlat(entity as Unit);
      const ox = xTileToWorld(xTile, RESOLUTION);
      const oy = yTileToWorld(yTile, RESOLUTION);
      const result = new Array<number>(relative.length);
      for (let i = 0; i < relative.length; i += 2) {
        result[i] = relative[i] + ox;
        result[i + 1] = relative[i + 1] + oy;
      }
      return result;
    }

    const cached = entityCache.get(entity);
    if (cached && cached.x === x && cached.y === y) return cached.points;

    const p = footprintPointsFlat(
      unitToTilemap(entity as Unit),
      entity.position,
    );
    const points = p.length ? p : [entity.position.x, entity.position.y];
    entityCache.set(entity, { x, y, points });
    return points;
  }
  return [entity.position.x, entity.position.y];
};

const tileSize = 0.25; // Each tile represents 0.25 units in world space

const footprintPointsFlat = (footprint: Footprint, position: Point) => {
  const points: number[] = [];

  const { width, height, left, top, map } = footprint;

  const tilemapOriginX =
    xTileToWorld(xWorldToTile(position.x, RESOLUTION), RESOLUTION) +
    left * tileSize;
  const tilemapOriginY =
    yTileToWorld(yWorldToTile(position.y, RESOLUTION), RESOLUTION) +
    top * tileSize;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!map[y * width + x]) continue;
      const px = x * tileSize + tilemapOriginX;
      const py = y * tileSize + tilemapOriginY;
      // Top left; could have been included by left, above, or left-and-above
      if (
        (y === 0 || !map[(y - 1) * width + x]) &&
        (y === 0 || x === 0 || !map[(y - 1) * width + x - 1]) &&
        (x === 0 || !map[y * width + x - 1])
      ) {
        points.push(px, py);
      }
      // Top right; could have only been included by above
      if (y === 0 || !map[(y - 1) * width + x]) {
        points.push(px + tileSize, py);
      }
      // Bottom right; could not have been included by any previous iteration
      points.push(px + tileSize, py + tileSize);
      // Bottom left; could have only been included by left
      if (x === 0 || !map[y * width + x - 1]) {
        points.push(px, py + tileSize);
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
    ? distanceBetweenEntities(mover, targetEntity, range)
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

  const distance = distanceBetweenEntities(
    attacker,
    target,
    attacker.attack.range,
  );

  if (distance > attacker.attack.range) return false;

  if (
    !skipFacingCheck &&
    attacker.turnSpeed &&
    !facingWithin(attacker, target.position, MAX_ATTACK_ANGLE)
  ) {
    return false;
  }

  return true;
};
