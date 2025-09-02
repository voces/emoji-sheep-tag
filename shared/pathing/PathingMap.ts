import { DIRECTION, PATHING_TYPES } from "./constants.ts";
import { BinaryHeap } from "./BinaryHeap.ts";
import {
  angleDifference,
  behind,
  distanceBetweenEntities,
  distanceBetweenPoints,
  infront,
  offset,
  Point,
  polarProject,
  trueMaxX,
  trueMinX,
} from "./math.ts";
import { memoize } from "./memoize.ts";
import { Tile } from "./Tile.ts";
import { Footprint, Pathing, PathingEntity, TargetEntity } from "./types.ts";
import {
  PATHING_WALK_ANGLE_DIFFERENCE,
  PATHING_WALK_IGNORE_DISTANCE,
} from "../constants.ts";
import { Entity } from "../types.ts";

let debugging = false;
// const elems: HTMLElement[] = [];
// export const toggleDebugging = (): void => {
// 	if (debugging) elems.forEach((elem) => arena.removeChild(elem));

// 	debugging = !debugging;
// };
try {
  Object.defineProperty(globalThis, "debugging", {
    set: (value) => (debugging = value),
    get: () => debugging,
  });
} catch {
  /* do nothing */
}

const DEFAULT_RESOLUTION = 1;

const MAX_TRIES = 8192;
const EPSILON = Number.EPSILON * 100;

// interface BaseEntity {
//   radius: number;
//   blocksPathing?: Pathing;
//   tilemap?: Footprint;
//   pathing?: Pathing;
//   requiresPathing?: Pathing;
//   tilemap?: Footprint;
//   structure?: boolean;
// }

// type SimpleEntity = BaseEntity & { x: number; y: number };
// type ComplexEntity = BaseEntity & { position: { x: number; y: number } };

// type Entity = SimpleEntity | ComplexEntity;

interface Cache {
  _linearPathable: (
    ...args: Parameters<typeof PathingMap.prototype._linearPathable>
  ) => ReturnType<typeof PathingMap.prototype._linearPathable>;
  _pathable: (
    ...args: Parameters<typeof PathingMap.prototype._pathable>
  ) => ReturnType<typeof PathingMap.prototype._pathable>;
  pointToTilemap: (
    ...args: Parameters<typeof PathingMap.prototype.pointToTilemap>
  ) => ReturnType<typeof PathingMap.prototype.pointToTilemap>;
}

//   0,   0, 255 = 0
//   0, 255, 255 = 0.25
//   0, 255,   0 = 0.5
// 255, 255,   0 = 0.75
// 255,   0,   0 = 1
// const r = (v: number) => (v < 0.5 ? 0 : v < 0.75 ? (v - 0.5) * 4 : 1);
// const g = (v: number) => (v < 0.25 ? v * 4 : v < 0.75 ? 1 : (1 - v) * 4);
// const b = (v: number) => (v < 0.25 ? 1 : v < 0.5 ? (0.5 - v) * 4 : 0);

// const placeTile = (x: number, y: number, v: number) => {
// 	const div = document.createElement("div");
// 	div.style.position = "absolute";
// 	div.style.top = y * 16 + "px";
// 	div.style.left = x * 16 + "px";
// 	div.style.zIndex = "10000";
// 	div.style.width = "16px";
// 	div.style.height = "16px";
// 	div.style.background = `rgba(${r(v) * 255}, ${g(v) * 255}, ${
// 		b(v) * 255
// 	}, 0.5)`;
// 	// div.cell = this.grid[ y ][ x ];
// 	arena.appendChild(div);
// 	elems.push(div);
// };

// Estimated cost remaining
const h = (a: Point, b: Point) =>
  Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

export class PathingMap {
  readonly resolution: number;
  private readonly layers?: number[][];
  readonly heightWorld: number;
  readonly widthWorld: number;
  readonly heightMap: number;
  readonly widthMap: number;
  readonly grid: Tile[][];

  // debugging
  // private _elem?: HTMLDivElement;

  // Maps entities to tiles
  private readonly entities: Map<PathingEntity, Tile[]> = new Map();

  constructor({
    pathing,
    resolution = DEFAULT_RESOLUTION,
    layers,
  }: {
    pathing: Pathing[][];
    resolution?: number;
    layers?: number[][];
  }) {
    this.resolution = resolution;

    this.layers = layers;

    this.heightWorld = pathing.length;
    this.widthWorld = pathing[0].length;

    this.heightMap = this.heightWorld * this.resolution;
    this.widthMap = this.widthWorld * this.resolution;

    this.grid = [];
    // Create tiles
    for (let y = 0; y < pathing.length; y++) {
      for (let x = 0; x < pathing[y].length; x++) {
        for (let y2 = 0; y2 < this.resolution; y2++) {
          if (!this.grid[y * this.resolution + y2]) {
            this.grid[y * this.resolution + y2] = [];
          }

          for (let x2 = 0; x2 < this.resolution; x2++) {
            const tile = new Tile(
              x * this.resolution + x2,
              y * this.resolution + y2,
              x + x2 / this.resolution,
              y + y2 / this.resolution,
              pathing[y][x],
            );
            this.grid[y * this.resolution + y2][
              x * this.resolution + x2
            ] = tile;
          }
        }
      }
    }

    // Tell them about each other
    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[y].length; x++) {
        const nodes: Tile[] = this.grid[y][x].nodes;

        // Below
        if (y < this.heightMap - 1) nodes.push(this.grid[y + 1][x]);
        // Right
        if (x < this.widthMap - 1) nodes.push(this.grid[y][x + 1]);
        // Left
        if (x > 0) nodes.push(this.grid[y][x - 1]);
        // Above
        if (y > 0) nodes.push(this.grid[y - 1][x]);
      }
    }

    if (debugging) {
      const oldPath = this.path;
      this.path = (...args) => {
        const ret = oldPath.call(this, ...args);
        return ret;
      };

      const oldRecheck = this.recheck;
      this.recheck = (...args) => {
        const ret = oldRecheck.call(this, ...args);
        return ret;
      };
    }
  }

  /**
   * Internals of PathingMap#pathable. Not private for interface typing
   * reasons.
   */
  _pathable(
    map: Footprint,
    xTile: number,
    yTile: number,
    test?: (tile: Tile) => boolean,
  ): boolean {
    if (
      xTile < 0 ||
      yTile < 0 ||
      xTile >= this.widthMap ||
      yTile >= this.heightMap
    ) {
      return false;
    }

    let i = 0;

    for (let y = yTile + map.top; y < yTile + map.height + map.top; y++) {
      for (
        let x = xTile + map.left;
        x < xTile + map.width + map.left;
        x++, i++
      ) {
        if (
          this.grid[y]?.[x] === undefined ||
          !this.grid[y][x].pathable(map.map[i]) ||
          (test && !test(this.grid[y][x]))
        ) {
          return false;
        }
      }
    }

    return true;
  }

  pathable(entity: PathingEntity, xWorld?: number, yWorld?: number): boolean {
    const position = entity.position;
    if (xWorld === undefined) xWorld = position.x;
    if (yWorld === undefined) yWorld = position.y;

    const xTile = this.xWorldToTile(xWorld);
    const yTile = this.yWorldToTile(yWorld);
    const map = entity.requiresTilemap ?? entity.tilemap ??
      this.pointToTilemap(xWorld, yWorld, entity.radius, {
        type: entity.requiresPathing ?? entity.pathing,
      });

    return this.withoutEntity(entity, () => this._pathable(map, xTile, yTile));
  }

  /**
   * Temporarily removes an entity from the PathingMap, invokes the passed
   * function, re-adds the entity, and returns the result of the function.
   */
  withoutEntity<A>(entity: PathingEntity, fn: () => A): A {
    const removed = this.entities.has(entity);
    if (removed) this.removeEntity(entity);

    const result = fn();

    if (removed) this.addEntity(entity);

    return result;
  }

  /**
   * Given an initial position `(xWorld, yWorld)`, returns the nearest point
   * the entity can be placed, measured by euclidean distance (thus would form
   * a circle instead of square for repeated placements).
   */
  nearestPathing(
    xWorld: number,
    yWorld: number,
    entity: PathingEntity,
    test?: (tile: Tile) => boolean,
  ): Point {
    return this.nearestPathingGen(xWorld, yWorld, entity, test).next().value!;
  }

  /**
   * Given an initial position `(xWorld, yWorld)`, returns the nearest points
   * the entity can be placed, measured by euclidean distance (thus would form
   * a circle instead of square for repeated placements).
   */
  private *nearestPathingGen(
    xWorld: number,
    yWorld: number,
    entity: PathingEntity,
    test?: (tile: Tile) => boolean,
  ): Generator<Point, Point> {
    const tile = this.entityToTile(entity, { x: xWorld, y: yWorld });

    // Calculate input from non-entity input
    const target = { x: xWorld, y: yWorld };

    // Calculate constants from entity
    const pathing = entity.requiresPathing === undefined
      ? entity.pathing
      : entity.requiresPathing;
    if (pathing === undefined) throw new Error("entity has no pathing");
    const minimalTilemap = entity.requiresTilemap ?? entity.tilemap ??
      this.pointToTilemap(
        entity.radius,
        entity.radius,
        entity.radius,
        { type: pathing },
      );
    const radiusOffset = entity.radius % (1 / this.resolution);
    const offset = (point: Point) => ({
      x: point.x + radiusOffset,
      y: point.y + radiusOffset,
    });

    // Create our heap
    const distance = (a: Point, b: Point) =>
      (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    // This won't desync anything
    // eslint-disable-next-line no-restricted-syntax
    const tag = Math.random();
    const heap = new BinaryHeap((node: Tile) => node.__np ?? 0);

    // Seed our heap
    const start = tile;
    start.__npTag = tag;
    start.__np = distance(target, offset(start.world));
    heap.push(start);

    let prev: Point | undefined;

    // Find a node!
    while (heap.length) {
      const current = heap.pop();

      if (
        current.pathable(pathing) &&
        this._pathable(minimalTilemap, current.x, current.y, test)
      ) {
        if (prev) yield prev;
        prev = offset(current.world);
      }

      current.nodes.forEach((neighbor) => {
        if (neighbor.__npTag === tag) return;
        neighbor.__npTag = tag;
        neighbor.__np = distance(target, offset(neighbor.world));

        heap.push(neighbor);
      });
    }

    // Found nothing, return input
    return prev ?? { x: xWorld, y: yWorld };
  }

  private _layer(xTile: number, yTile: number): number | undefined {
    if (!this.layers) return;
    if (yTile < 0) return;

    xTile = Math.floor(xTile / this.resolution);
    yTile = Math.floor(yTile / this.resolution);

    if (this.layers.length <= yTile) return;
    return this.layers[yTile][xTile];
  }

  /**
   * Returns the layer for a given world coordinate. Some pathing calculations
   * are constrained to specific layers, such as
   * PathingMap#nearestSpiralPathing.
   */
  layer(xWorld: number, yWorld: number): number | undefined {
    if (!this.layers) return;
    if (yWorld < 0) return;

    xWorld = Math.floor(xWorld);
    yWorld = Math.floor(yWorld);

    if (this.layers.length <= yWorld) return;
    return this.layers[yWorld][xWorld];
  }

  /**
   * Given an initial position `(xWorld, yWorld)`, returns the nearest point
   * on the same layer at which the entity can be placed, as discovered by
   * spiraling out (thus would form a square instead of circle for repeated
   * placements).
   */
  nearestSpiralPathing(
    xWorld: number,
    yWorld: number,
    entity: PathingEntity,
    layer = this.layer(xWorld, yWorld),
  ): Point {
    const originalX = xWorld;
    const originalY = yWorld;

    let xTile = this.xWorldToTile(xWorld);
    let yTile = this.yWorldToTile(yWorld);

    let attemptLayer = this._layer(xTile, yTile);

    if (layer === attemptLayer) {
      const tilemap = entity.requiresTilemap ?? entity.tilemap;
      if (tilemap) {
        if (this._pathable(tilemap, xTile, yTile)) {
          return { x: this.xTileToWorld(xTile), y: this.yTileToWorld(yTile) };
        }
      } else if (
        this._pathable(
          this.pointToTilemap(
            xWorld,
            yWorld,
            entity.radius,
            {
              type: entity.requiresPathing === undefined
                ? entity.pathing
                : entity.requiresPathing,
            },
          ),
          xTile,
          yTile,
        )
      ) return { x: xWorld, y: yWorld };
    }

    const xMiss = Math.abs(xWorld * this.resolution - xTile);
    const yMiss = Math.abs(yWorld * this.resolution - yTile);

    // todo mirror WC3 for equal misses
    // 0 down, 1 left, 2 up, 3 right
    let direction = Math.abs(0.5 - xMiss) > Math.abs(0.5 - yMiss)
      ? xMiss < 0.5 ? DIRECTION.LEFT : DIRECTION.RIGHT
      : yMiss < 0.5 && yMiss >= 0
      ? DIRECTION.UP
      : DIRECTION.DOWN;

    let steps = 0;
    const stride = entity.requiresTilemap ?? entity.tilemap ? 2 : 1;
    let initialSteps = 0;

    let remainingTries = MAX_TRIES;

    let minimalTilemap = entity.requiresTilemap ?? entity.tilemap;
    let offset;
    if (minimalTilemap) {
      offset = {
        x: minimalTilemap.left / this.resolution -
          (minimalTilemap.width % 4 === 0 ? 0 : 0.25),
        y: minimalTilemap.top / this.resolution +
          (minimalTilemap.height % 4 === 0 ? 0 : 0.25),
      };
    } else {
      minimalTilemap = this.pointToTilemap(
        entity.radius,
        entity.radius,
        entity.radius,
        { type: entity.requiresPathing ?? entity.pathing },
      );
      offset = {
        x: entity.radius % (1 / this.resolution),
        y: entity.radius % (1 / this.resolution),
      };
    }

    const tried = [];
    if (this.grid[yTile] && this.grid[yTile][xTile]) {
      tried.push(this.grid[yTile][xTile]);
    }

    while (
      !this._pathable(minimalTilemap, xTile, yTile) ||
      (layer !== undefined && attemptLayer !== layer)
    ) {
      if (!remainingTries--) return { x: originalX, y: originalY };

      switch (direction) {
        case DIRECTION.DOWN:
          yTile += stride;
          break;
        case DIRECTION.RIGHT:
          xTile += stride;
          break;
        case DIRECTION.UP:
          yTile -= stride;
          break;
        case DIRECTION.LEFT:
          xTile -= stride;
          break;
      }

      if (this.grid[yTile] && this.grid[yTile][xTile]) {
        tried.push(this.grid[yTile][xTile]);
      }

      if (steps === 0) {
        steps = initialSteps;
        if (direction === DIRECTION.DOWN || direction === DIRECTION.UP) {
          initialSteps++;
        }
        direction = (direction + 1) % 4;
      } else steps--;

      attemptLayer = this._layer(xTile, yTile);
    }

    return {
      x: this.xTileToWorld(xTile) + offset.x,
      y: this.yTileToWorld(yTile) + offset.y,
    };
  }

  worldToTile(world: Point): Tile {
    return this.grid[this.yWorldToTile(world.y)]?.[
      this.xWorldToTile(world.x)
    ];
  }

  xWorldToTile(x: number): number {
    return Math.floor(x * this.resolution);
  }

  yWorldToTile(y: number): number {
    return Math.floor(y * this.resolution);
  }

  xTileToWorld(x: number): number {
    return x / this.resolution;
  }

  yTileToWorld(y: number): number {
    return y / this.resolution;
  }

  /**
   * Calculates a tilemap/footprint required to place something at `(xWorld,
   * yWorld)` with `radius`.
   */
  pointToTilemap(
    xWorld: number,
    yWorld: number,
    radius = 0,
    { type = PATHING_TYPES.WALKABLE } = {},
  ): Footprint {
    radius -= EPSILON * radius * this.widthWorld;

    const xTile = this.xWorldToTile(xWorld);
    const yTile = this.yWorldToTile(yWorld);

    const map = [];

    const xMiss = xTile / this.resolution - xWorld;
    const yMiss = yTile / this.resolution - yWorld;

    const minX = this.xWorldToTile(xWorld - radius) - xTile;
    const maxX = this.xWorldToTile(xWorld + radius) - xTile;
    const minY = this.yWorldToTile(yWorld - radius) - yTile;
    const maxY = this.yWorldToTile(yWorld + radius) - yTile;

    const radiusSquared = radius ** 2;

    for (let tY = minY; tY <= maxY; tY++) {
      for (let tX = minX; tX <= maxX; tX++) {
        const yDelta = tY < 0
          ? (tY + 1) / this.resolution + yMiss
          : tY > 0
          ? tY / this.resolution + yMiss
          : 0;
        const xDelta = tX < 0
          ? (tX + 1) / this.resolution + xMiss
          : tX > 0
          ? tX / this.resolution + xMiss
          : 0;

        if (xDelta ** 2 + yDelta ** 2 < radiusSquared) map.push(type);
        else map.push(0);
      }
    }

    const footprint = {
      map,
      top: minY,
      left: minX,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };

    return footprint;
  }

  private yBoundTile(yIndex: number): number {
    return Math.max(Math.min(yIndex, this.heightMap - 1), 0);
  }

  private xBoundTile(xIndex: number): number {
    return Math.max(Math.min(xIndex, this.widthMap - 1), 0);
  }

  // step(
  //   entity: PathingEntity,
  //   target: TargetEntity | Readonly<Point>,
  //   distance: number,
  // ) {
  //   const removed = this.entities.has(entity);
  //   if (removed) this.removeEntity(entity);

  //   // We assume an entity shoved into the top left corner is good
  //   const pathing = entity.requiresPathing === undefined
  //     ? entity.pathing
  //     : entity.requiresPathing;
  //   if (pathing === undefined) throw new Error("entity has no pathing");
  //   // const minimalTilemap = this.pointToTilemap(
  //   //   entity.radius,
  //   //   entity.radius,
  //   //   entity.radius,
  //   //   { type: pathing },
  //   // );

  //   // const offset = entity.radius % (1 / this.resolution);
  //   // const startReal = {
  //   //   x: entity.position.x * this.resolution,
  //   //   y: entity.position.y * this.resolution,
  //   // };

  //   const targetPosition = "x" in target ? target : target.position;

  //   // const startTile = this.entityToTile(entity);

  //   const angle = Math.atan2(
  //     targetPosition.y - entity.position.y,
  //     targetPosition.x - entity.position.x,
  //   );

  //   // Simple: diag
  //   {
  //     const diag = {
  //       x: entity.position.x + distance * Math.cos(angle),
  //       y: entity.position.y + distance * Math.sin(angle),
  //     };
  //     if (this.linearPathable(entity, entity.position, diag)) return diag;
  //   }

  //   const dirs = closestCardinalDirections(angle);
  //   for (const [x, y] of dirs) {
  //     const point = {
  //       x: entity.position.x + distance * x,
  //       y: entity.position.y + distance * y,
  //     };
  //     if (this.linearPathable(entity, entity.position, point)) return point;
  //   }
  // }

  // Adapted from https://github.com/bgrins/javascript-astar/blob/master/astar.js
  // towards Theta*
  // This gets really sad when a path is not possible
  /**
   * Calculates the shortest path for an entity to reach `target`. If a path
   * is not possible, or is extremely long, a partial path will be returned.
   */
  path(
    entity: PathingEntity,
    target: TargetEntity | Readonly<Point>,
    {
      start = entity.position,
      distanceFromTarget,
      removeMovingEntities = true,
    }: {
      start?: Point;
      distanceFromTarget?: number;
      removeMovingEntities?: boolean;
    } = {},
  ): Point[] {
    if (typeof entity.radius !== "number") {
      throw new Error("Can only path find radial entities");
    }

    if (distanceFromTarget) distanceFromTarget *= this.resolution;

    // If already in range, just return start
    if (
      typeof distanceFromTarget === "number" && "position" in target &&
      distanceBetweenEntities(entity, target) * this.resolution <
        distanceFromTarget
      // Should I return start?
    ) return [];

    const cache: Cache = {
      _linearPathable: memoize((...args) => this._linearPathable(...args)),
      _pathable: memoize((...args) => this._pathable(...args)),
      pointToTilemap: memoize((...args) => this.pointToTilemap(...args)),
    };

    const removed = this.entities.has(entity);
    if (removed) this.removeEntity(entity);

    const removedMovingEntities = new Set<PathingEntity>();
    if (removeMovingEntities) {
      for (const e of this.entities.keys()) {
        if (!e.order || !("path" in e.order) || !e.order.path?.length) {
          continue;
        }

        // Don't remove entities that are targeting the pathing entity
        if ("targetId" in e.order && e.order.targetId === entity.id) {
          continue;
        }

        const dist = distanceBetweenEntities(e, entity);
        const aDist = Math.abs(angleDifference(
          Math.atan2(
            e.order.path[0].y - e.position.y,
            e.order.path[0].x - e.position.x,
          ),
          Math.atan2(
            ("x" in target ? target.y : target.position.y) -
              entity.position.y,
            ("x" in target ? target.x : target.position.x) -
              entity.position.x,
          ),
        ));
        if (
          dist < PATHING_WALK_IGNORE_DISTANCE &&
          aDist > PATHING_WALK_ANGLE_DIFFERENCE
        ) continue;
        removedMovingEntities.add(e);
        this.removeEntity(e);
      }
    }

    // We assume an entity shoved into the top left corner is good
    const pathing = entity.requiresPathing === undefined
      ? entity.pathing
      : entity.requiresPathing;
    if (pathing === undefined) throw new Error("entity has no pathing");
    const minimalTilemap = cache.pointToTilemap(
      entity.radius,
      entity.radius,
      entity.radius,
      { type: pathing },
    );

    const offset = entity.radius % (1 / this.resolution);
    // We can assume start is pathable
    const startReal = {
      x: start.x * this.resolution,
      y: start.y * this.resolution,
    };

    const targetPosition = "x" in target ? target : target.position;
    const startTile = this.entityToTile(entity);
    // For target, if the exact spot is pathable, we aim towards that; otherwise the nearest spot
    const targetTile = this.entityToTile(entity, targetPosition);

    const targetPathable = targetTile &&
      targetTile.pathable(pathing) &&
      this.pathable(entity, targetPosition.x, targetPosition.y);

    const targetReal = {
      x: targetPosition.x * this.resolution,
      y: targetPosition.y * this.resolution,
    };

    const endTag = Math.random();
    const endHeap = new BinaryHeap(
      (node: Tile) => node.__endRealPlusEstimatedCost ?? 0,
    );
    let endBest = targetTile;
    const endTiles = [targetTile];

    if (targetPathable) {
      const targetClosestReal = targetPathable
        ? {
          x: targetPosition.x * this.resolution,
          y: targetPosition.y * this.resolution,
        }
        : targetTile;

      // If we start and end on the same tile, just move between them
      if (startTile === targetTile && this.pathable(entity)) {
        if (removed) this.addEntity(entity);
        for (const entity of removedMovingEntities) this.addEntity(entity);
        return [
          { x: start.x, y: start.y },
          {
            x: targetClosestReal.x / this.resolution,
            y: targetClosestReal.y / this.resolution,
          },
        ];
      }

      endHeap.push(targetTile);
      targetTile.__endTag = endTag;
      targetTile.__endRealCostFromOrigin = distanceFromTarget
        ? Math.max(
          h(targetReal, targetTile) - distanceFromTarget,
          0,
        )
        : h(targetClosestReal, targetTile);
      targetTile.__endEstimatedCostRemaining = h(targetTile, startReal);
      targetTile.__endRealPlusEstimatedCost =
        targetTile.__endEstimatedCostRemaining +
        targetTile.__endRealCostFromOrigin;
      targetTile.__endVisited = false;
      targetTile.__endClosed = false;
      targetTile.__endParent = null;
    } else {
      const endNearestPathingGen: Generator<Point, Point, never> = this
        .nearestPathingGen(targetPosition.x, targetPosition.y, entity);

      let next = endNearestPathingGen.next();
      let { x, y } = next.value;

      let tile = this.grid[
        Math.round((y - offset) * this.resolution)
      ][Math.round((x - offset) * this.resolution)];

      const maxEndEstimate = "position" in target
        ? distanceBetweenEntities({
          ...entity,
          position: {
            x: this.xTileToWorld(tile.x),
            y: this.yTileToWorld(tile.y),
          },
        }, target) * this.resolution
        : h(targetReal, tile);

      // TODO: This is unbounded and does not scale!
      while (
        "position" in target
          ? distanceBetweenEntities({
                ...entity,
                position: {
                  x: this.xTileToWorld(tile.x),
                  y: this.yTileToWorld(tile.y),
                },
              }, target) * this.resolution <= maxEndEstimate
          : h(targetReal, tile) <= maxEndEstimate
      ) {
        if (cache._pathable(minimalTilemap, tile.x, tile.y)) {
          endTiles.push(tile);
          endHeap.push(tile);
          tile.__endTag = endTag;
          tile.__endRealCostFromOrigin = 0;
          tile.__endEstimatedCostRemaining = h(tile, startReal);
          tile.__endRealPlusEstimatedCost = tile.__endEstimatedCostRemaining +
            tile.__endRealCostFromOrigin;
          tile.__endVisited = false;
          tile.__endClosed = false;
          tile.__endParent = null;
        }

        // Prime next
        if (next.done) break;
        next = endNearestPathingGen.next();
        ({ x, y } = next.value);
        tile = this.grid[
          Math.round((y - offset) * this.resolution)
        ][Math.round((x - offset) * this.resolution)];
      }
      endBest = endHeap[0];
    }

    const startHeap = new BinaryHeap(
      (node: Tile) => node.__startRealPlusEstimatedCost ?? 0,
    );
    // This won't desync anything.
    // eslint-disable-next-line no-restricted-syntax
    const startTag = Math.random();
    let startBest = startTile;
    startHeap.push(startTile);
    startTile.__startTag = startTag;
    startTile.__startRealCostFromOrigin = h(startReal, startTile);
    startTile.__startEstimatedCostRemaining = h(startTile, endHeap[0]);
    startTile.__startRealPlusEstimatedCost =
      startTile.__startEstimatedCostRemaining +
      startTile.__startRealCostFromOrigin;
    startTile.__startVisited = false;
    startTile.__startClosed = false;
    startTile.__startParent = null;

    let checksSinceBestChange = 0;
    while (startHeap.length) {
      // Degenerate case: target is close to start, but ~blocked off
      if (checksSinceBestChange++ > 500) break;

      // Start to End
      const startCurrent = startHeap.pop();

      if (endTiles.includes(startCurrent)) {
        startBest = startCurrent;
        break;
      } else if (startCurrent.__endTag === endTag) {
        startBest = endBest = startCurrent;
        break;
      } else if (
        typeof distanceFromTarget === "number" &&
        ("position" in target
          ? distanceBetweenEntities(
                { ...entity, position: startCurrent.world },
                target,
              ) * this.resolution < distanceFromTarget
          : distanceBetweenPoints(startCurrent.world, target) *
              this.resolution < distanceFromTarget)
      ) {
        startBest = startCurrent;
        break;
      }

      startCurrent.__startClosed = true;

      const startNeighbors = startCurrent.nodes;

      for (let i = 0, length = startNeighbors.length; i < length; i++) {
        const neighbor = startNeighbors[i];

        if (neighbor.__startTag !== startTag) {
          neighbor.__startTag = startTag;
          neighbor.__startEstimatedCostRemaining = 0;
          neighbor.__startRealPlusEstimatedCost = 0;
          neighbor.__startRealCostFromOrigin = 0;
          neighbor.__startVisited = false;
          neighbor.__startClosed = false;
          neighbor.__startParent = null;
        }

        const wasVisited = neighbor.__startVisited;

        if (!wasVisited) {
          if (neighbor.__startClosed || !neighbor.pathable(pathing)) {
            continue;
          } else if (
            !cache._pathable(minimalTilemap, neighbor.x, neighbor.y)
          ) {
            neighbor.__startClosed = true;
            continue;
          }
        }

        const gScore = (startCurrent.__startRealCostFromOrigin ?? 0) + 1;

        // Line of sight test (this is laggy)
        if (
          startCurrent.__startParent &&
          cache._linearPathable(
            entity,
            startCurrent.__startParent,
            neighbor,
          )
        ) {
          const gScore =
            (startCurrent.__startParent.__startRealCostFromOrigin ??
              0) + h(startCurrent.__startParent, neighbor);
          // First visit or better score than previously known
          if (
            !neighbor.__startVisited ||
            gScore < (neighbor.__startRealCostFromOrigin ?? 0)
          ) {
            neighbor.__startVisited = true;
            neighbor.__startParent = startCurrent.__startParent;
            neighbor.__startEstimatedCostRemaining =
              neighbor.__startEstimatedCostRemaining! ||
              h(neighbor, targetReal);
            neighbor.__startRealCostFromOrigin = gScore;
            neighbor.__startRealPlusEstimatedCost =
              neighbor.__startRealCostFromOrigin +
              neighbor.__startEstimatedCostRemaining;

            if (
              neighbor.__startEstimatedCostRemaining <
                (startBest.__startEstimatedCostRemaining ??
                  0) ||
              (neighbor.__startEstimatedCostRemaining ===
                  startBest.__startEstimatedCostRemaining &&
                neighbor.__startRealCostFromOrigin <
                  (startBest.__startRealCostFromOrigin ?? 0))
            ) {
              startBest = neighbor;
              checksSinceBestChange = 0;
            }

            if (!wasVisited) startHeap.push(neighbor);
            else {
              const index = startHeap.indexOf(neighbor);
              if (index >= 0) startHeap.sinkDown(index);
            }
          }

          // First visit or better score than previously known
        } else if (
          !neighbor.__startVisited ||
          gScore < (neighbor.__startRealCostFromOrigin ?? 0)
        ) {
          neighbor.__startVisited = true;
          neighbor.__startParent = startCurrent;
          neighbor.__startEstimatedCostRemaining =
            neighbor.__startEstimatedCostRemaining! ||
            h(neighbor, targetReal);
          neighbor.__startRealCostFromOrigin = gScore;
          neighbor.__startRealPlusEstimatedCost =
            neighbor.__startRealCostFromOrigin +
            neighbor.__startEstimatedCostRemaining;

          if (
            neighbor.__startEstimatedCostRemaining <
              (startBest.__startEstimatedCostRemaining ?? 0) ||
            (neighbor.__startEstimatedCostRemaining ===
                startBest.__startEstimatedCostRemaining &&
              neighbor.__startRealCostFromOrigin <
                (startBest.__startRealCostFromOrigin ?? 0))
          ) {
            startBest = neighbor;
            checksSinceBestChange = 0;
          }

          if (!wasVisited) startHeap.push(neighbor);
          else {
            const index = startHeap.indexOf(neighbor);
            if (index >= 0) startHeap.sinkDown(index);
          }
        }
      }

      // End to Start

      if (!endHeap.length) {
        const { x, y } = this.nearestPathing(
          targetPosition.x,
          targetPosition.y,
          entity,
          (tile) => tile.__endTag !== endTag,
        );
        const newEndtile =
          this.grid[Math.round((y - offset) * this.resolution)][
            Math.round((x - offset) * this.resolution)
          ];

        endBest = newEndtile;
        endHeap.push(newEndtile);
        newEndtile.__endTag = endTag;
        newEndtile.__endRealCostFromOrigin = h(targetReal, newEndtile);
        newEndtile.__endEstimatedCostRemaining = h(
          newEndtile,
          startReal,
        );
        newEndtile.__endRealPlusEstimatedCost =
          newEndtile.__endEstimatedCostRemaining +
          newEndtile.__endRealCostFromOrigin;
        newEndtile.__endVisited = false;
        newEndtile.__endClosed = false;
        newEndtile.__endParent = null;
      }

      const endCurrent = endHeap.pop();

      if (endCurrent === startTile) {
        endBest = startTile;
        break;
      } else if (endCurrent.__startTag === startTag) {
        startBest = endBest = endCurrent;
        break;
      }

      endCurrent.__endClosed = true;

      const endNeighbors = endCurrent.nodes;

      for (let i = 0, length = endNeighbors.length; i < length; i++) {
        const neighbor = endNeighbors[i];

        if (neighbor.__endTag !== endTag) {
          neighbor.__endTag = endTag;
          neighbor.__endEstimatedCostRemaining = 0;
          neighbor.__endRealPlusEstimatedCost = 0;
          neighbor.__endRealCostFromOrigin = 0;
          neighbor.__endVisited = false;
          neighbor.__endClosed = false;
          neighbor.__endParent = null;
        }

        const wasVisited = neighbor.__endVisited;

        if (!wasVisited) {
          if (neighbor.__endClosed || !neighbor.pathable(pathing)) {
            continue;
          } else if (
            !cache._pathable(minimalTilemap, neighbor.x, neighbor.y)
          ) {
            neighbor.__endClosed = true;
            continue;
          }
        }

        const gScore = (endCurrent.__endRealCostFromOrigin ?? 0) + 1;

        // Line of sight test (this is laggy, so disabled ATM)
        if (
          endCurrent.__endParent &&
          cache._linearPathable(
            entity,
            endCurrent.__endParent,
            neighbor,
          )
        ) {
          const gScore = (endCurrent.__endParent.__endRealCostFromOrigin ?? 0) +
            h(endCurrent.__endParent, neighbor);
          // First visit or better score than previously known
          if (
            !neighbor.__endVisited ||
            gScore < (neighbor.__endRealCostFromOrigin ?? 0)
          ) {
            neighbor.__endVisited = true;
            neighbor.__endParent = endCurrent.__endParent;
            neighbor.__endEstimatedCostRemaining =
              neighbor.__endEstimatedCostRemaining! ||
              h(neighbor, startReal);
            neighbor.__endRealCostFromOrigin = gScore;
            neighbor.__endRealPlusEstimatedCost =
              neighbor.__endRealCostFromOrigin +
              neighbor.__endEstimatedCostRemaining;

            if (
              neighbor.__endEstimatedCostRemaining <
                (endBest.__endEstimatedCostRemaining ?? 0) ||
              (neighbor.__endEstimatedCostRemaining ===
                  endBest.__endEstimatedCostRemaining &&
                neighbor.__endRealCostFromOrigin <
                  (endBest.__endRealCostFromOrigin ?? 0))
            ) {
              endBest = neighbor;
              checksSinceBestChange = 0;
            }

            if (!wasVisited) endHeap.push(neighbor);
            else {
              const index = endHeap.indexOf(neighbor);
              if (index >= 0) endHeap.sinkDown(index);
            }
          }

          // First visit or better score than previously known
        } else if (
          !neighbor.__endVisited ||
          gScore < (neighbor.__endRealCostFromOrigin ?? 0)
        ) {
          neighbor.__endVisited = true;
          neighbor.__endParent = endCurrent;
          neighbor.__endEstimatedCostRemaining =
            neighbor.__endEstimatedCostRemaining! ||
            h(neighbor, startReal);
          neighbor.__endRealCostFromOrigin = gScore;
          neighbor.__endRealPlusEstimatedCost =
            neighbor.__endRealCostFromOrigin +
            neighbor.__endEstimatedCostRemaining;

          if (
            neighbor.__endEstimatedCostRemaining <
              (endBest.__endEstimatedCostRemaining ?? 0) ||
            (neighbor.__endEstimatedCostRemaining ===
                endBest.__endEstimatedCostRemaining &&
              neighbor.__endRealCostFromOrigin <
                (endBest.__endRealCostFromOrigin ?? 0))
          ) {
            endBest = neighbor;
            checksSinceBestChange = 0;
          }

          if (!wasVisited) endHeap.push(neighbor);
          else {
            const index = endHeap.indexOf(neighbor);
            if (index >= 0) endHeap.sinkDown(index);
          }
        }
      }
    }

    // if (debugging) {
    // 	elems.forEach((elem) => arena.removeChild(elem));
    // 	elems.splice(0);
    // 	const max = this.grid.reduce(
    // 		(max, row) =>
    // 			row.reduce(
    // 				(max, cell) =>
    // 					Math.max(
    // 						max,
    // 						cell.__startTag === startTag &&
    // 							cell.__startVisited
    // 							? cell.__startRealPlusEstimatedCost ?? 0
    // 							: cell.__endTag === endTag &&
    // 							  cell.__endVisited
    // 							? cell.__endRealPlusEstimatedCost ?? 0
    // 							: -Infinity,
    // 					),
    // 				max,
    // 			),
    // 		-Infinity,
    // 	);
    // 	const min = this.grid.reduce(
    // 		(min, row) =>
    // 			row.reduce(
    // 				(min, cell) =>
    // 					Math.min(
    // 						min,
    // 						cell.__startTag === startTag &&
    // 							cell.__startVisited
    // 							? cell.__startRealPlusEstimatedCost ?? 0
    // 							: cell.__endTag === endTag &&
    // 							  cell.__endVisited
    // 							? cell.__endRealPlusEstimatedCost ?? 0
    // 							: Infinity,
    // 					),
    // 				min,
    // 			),
    // 		Infinity,
    // 	);
    // 	const d = max - min;
    // 	for (let y = 0; y < this.grid.length; y++)
    // 		for (let x = 0; x < this.grid[y].length; x++)
    // 			if (
    // 				(this.grid[y][x].__startTag === startTag &&
    // 					this.grid[y][x].__startVisited) ||
    // 				(this.grid[y][x].__endTag === endTag &&
    // 					this.grid[y][x].__endVisited)
    // 			)
    // 				placeTile(
    // 					x,
    // 					y,
    // 					((this.grid[y][x].__startTag === startTag &&
    // 					this.grid[y][x].__startVisited
    // 						? this.grid[y][x]
    // 								.__startRealPlusEstimatedCost ?? 0
    // 						: this.grid[y][x].__endTag === endTag &&
    // 						  this.grid[y][x].__endVisited
    // 						? this.grid[y][x].__endRealPlusEstimatedCost ??
    // 						  0
    // 						: Infinity) -
    // 						min) /
    // 						d,
    // 				);
    // }

    const pathTiles: Tile[] = [];
    let startCurrent: Tile | null | undefined = startBest;
    while (startCurrent) {
      pathTiles.unshift(startCurrent);
      startCurrent = startCurrent.__startParent;
    }

    if (startBest === endBest) {
      let endCurrent = startBest.__endParent;
      while (endCurrent) {
        pathTiles.push(endCurrent);
        endCurrent = endCurrent.__endParent;
      }
    }

    this._smooth(entity, pathTiles, cache);

    const pathWorld = pathTiles.map((tile) => ({
      x: this.xTileToWorld(tile.x) + offset,
      y: this.yTileToWorld(tile.y) + offset,
    }));

    const last = pathTiles[pathTiles.length - 1];

    const path = [{ x: start.x, y: start.y }];

    if (
      pathWorld.length > 1 &&
      (pathWorld[0].x !== start.x || pathWorld[0].y !== start.y) &&
      !this.linearPathable(entity, start, pathWorld[1])
    ) path.push(pathWorld[0]);

    // const path = pathWorld.length > 1 &&
    //     (pathWorld[0].x !== start.x || pathWorld[0].y !== start.y)
    //   ? this.linearPathable(entity, start, pathWorld[1])
    //     // Can skip first tile since we can path directly to the second
    //     ? [{ x: start.x, y: start.y }]
    //     // Must go through first tile since we cannot path directly to the second
    //     : [{ x: start.x, y: start.y }, pathWorld[0]]
    //   : [pathWorld[0]];

    path.push(...pathWorld.slice(1, -1));

    if (
      !this.linearPathable(entity, path[path.length - 1], targetPosition) ||
      (last !== targetTile)
    ) path.push(pathWorld[pathWorld.length - 1]);

    if (last === targetTile && targetPathable) path.push(targetPosition);

    // Step back with a tolerance between 99% and 100% distance to target
    // E.g., if the passed distance is 100, the path will terminate (if
    // possible) between 99 and 100 units away.
    const tolerance = (distanceFromTarget ?? 0) * 0.01;
    if (
      typeof distanceFromTarget === "number" && "position" in target &&
      path.length > 1 &&
      distanceBetweenEntities(
              { ...entity, position: path[path.length - 1] },
              target,
            ) * this.resolution < distanceFromTarget - tolerance
    ) {
      let a = path[path.length - 1];
      let b = path[path.length - 2];
      let mid;
      let itrs = 0;
      while (itrs < 15) {
        itrs++;
        mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const currentDistance = distanceBetweenEntities({
          ...entity,
          position: mid,
        }, target) * this.resolution;
        const diff = distanceFromTarget - currentDistance;
        if (diff >= 0 && diff <= tolerance) break;
        if (currentDistance < distanceFromTarget) a = mid;
        else b = mid;
      }
      if (mid && itrs < 15) path[path.length - 1] = mid;
    }

    if (removed) this.addEntity(entity);
    for (const entity of removedMovingEntities) this.addEntity(entity);

    return path;
  }

  /**
   * Rechecks a path to make sure it's still pathable. Can return false even
   * if the path is still pathable.
   * @param path The array of points that make up the path to be checked.
   * @param entity The object of the path to be checked. Includes clearance
   * (radius) and pathing type.
   * @param amount How far along the path we should check at a minimum. We'll
   * likely overcheck, since we just verify segments of the path.
   * @param offset How far along that path we start checking at maximum.
   */
  recheck(
    path: Point[],
    entity: PathingEntity,
    amount = Infinity,
    offset = 0,
  ): boolean {
    const removed = this.entities.has(entity);
    if (removed) this.removeEntity(entity);

    let cur = 0;
    let distanceSquared = 0;
    const offsetSquared = offset ** 2;
    const amountSqaured = offsetSquared + amount ** 2;
    let segmentLength = (path[1].x - path[0].x) ** 2 +
      (path[1].y - path[0].y) ** 2;

    // Skip parts of the path we aren't rechecking.
    while (
      distanceSquared + segmentLength < offsetSquared &&
      cur < path.length - 2
    ) {
      distanceSquared += segmentLength;
      cur++;
      segmentLength = (path[cur + 1].x - path[cur].x) ** 2 +
        (path[cur + 1].y - path[cur].y) ** 2;
    }

    if (cur === path.length - 1) {
      return this.pathable(entity, path[cur].x, path[cur].y);
    }

    while (cur < path.length - 1 && distanceSquared < amountSqaured) {
      if (!this.linearPathable(entity, path[cur], path[cur + 1])) {
        if (removed) this.addEntity(entity);
        return false;
      }

      distanceSquared += (path[cur + 1].x - path[cur].x) ** 2 +
        (path[cur + 1].y - path[cur].y) ** 2;
      cur++;
    }

    if (removed) this.addEntity(entity);
    return true;
  }

  private _smooth(
    entity: PathingEntity,
    path: Tile[],
    cache: Cache = this,
  ): void {
    for (let skip = path.length - 1; skip > 1; skip--) {
      for (let index = 0; index < path.length - skip; index++) {
        if (
          cache._linearPathable(
            entity,
            path[index],
            path[index + skip],
          )
        ) {
          path.splice(index + 1, skip - 1);
          skip = path.length;
          break;
        }
      }
    }
  }

  /**
   * Internals of ParthingMap#linearPathable. Public for testing purposes.
   */
  _linearPathable(
    entity: PathingEntity,
    startTile: Tile,
    endTile: Tile,
  ): boolean {
    const radiusOffset = entity.radius % (1 / this.resolution);
    return this.linearPathable(
      entity,
      offset(startTile.world, radiusOffset),
      offset(endTile.world, radiusOffset),
    );
  }

  entityToTileCoordsBounded(
    entity: PathingEntity,
    position: Point = entity.position,
  ): { x: number; y: number } {
    const nudge = EPSILON * entity.radius * this.widthWorld;
    return {
      x: this.xBoundTile(
        Math.round(position.x * this.resolution - nudge),
      ),
      y: this.yBoundTile(
        Math.round(position.y * this.resolution - nudge),
      ),
    };
  }

  // BAD?
  entityToTile(entity: PathingEntity, position: Point = entity.position): Tile {
    const { x, y } = this.entityToTileCoordsBounded(entity, position);
    return this.grid[y][x];
  }

  /**
   * Checks whether an entity is clearance to go from `startWorld` to
   * `endWorld`.
   */
  linearPathable(
    entity: PathingEntity,
    startWorld: Point,
    endWorld: Point,
  ): boolean {
    // Restrictions + pull fields off entity
    if (typeof entity.radius !== "number") {
      throw new Error("Can only path find radial entities");
    }
    const radius = entity.radius * this.resolution -
      EPSILON *
        entity.radius *
        this.widthWorld *
        this.resolution;
    const pathing = entity.requiresPathing !== undefined
      ? entity.requiresPathing
      : entity.pathing;
    if (pathing === undefined) throw "entity has no pathing";

    // Swap so we're going right
    [startWorld, endWorld] = startWorld.x <= endWorld.x
      ? [startWorld, endWorld]
      : [endWorld, startWorld];

    {
      const startTile = this.worldToTile(startWorld);
      const endTile = this.worldToTile(endWorld);

      if (startTile === endTile) {
        const map = entity.requiresTilemap ?? entity.tilemap ??
          this.pointToTilemap(startWorld.x, startWorld.y, entity.radius, {
            type: pathing,
          });

        return this.withoutEntity(
          entity,
          () => this._pathable(map, startTile.x, startTile.y),
        );
      }
    }

    /** Floating point on tilemap (so world * resolution) */
    const startPoint = {
      x: startWorld.x * this.resolution,
      y: startWorld.y * this.resolution,
    };
    /** Floating point on tilemap (so world * resolution) */
    const endPoint = {
      x: endWorld.x * this.resolution,
      y: endWorld.y * this.resolution,
    };

    // Describe approach
    const angle = Math.atan2(
      endPoint.y - startPoint.y,
      endPoint.x - startPoint.x,
    );
    const tan = (endPoint.x - startPoint.x) / (endPoint.y - startPoint.y);
    const positiveSlope = endPoint.y > startPoint.y;

    // for looping
    const minY = positiveSlope
      ? Math.floor(startPoint.y - radius)
      : Math.floor(endPoint.y - radius);
    const maxY = positiveSlope
      ? Math.floor(endPoint.y + radius)
      : Math.floor(startPoint.y + radius);
    const yStart = positiveSlope ? minY : maxY;
    const yStep = positiveSlope ? 1 : -1;
    const ySteps = Math.abs(minY - maxY);

    // for clamping
    const minX = Math.floor(startPoint.x - radius);
    const maxX = Math.floor(endPoint.x + radius);

    const leftTangent = polarProject(
      startPoint,
      angle - Math.PI / 2,
      radius,
    );
    const rightTangent = polarProject(
      startPoint,
      angle + Math.PI / 2,
      radius,
    );
    const endLeftTangent = polarProject(
      endPoint,
      angle - Math.PI / 2,
      radius,
    );
    const endRightTangent = polarProject(
      endPoint,
      angle + Math.PI / 2,
      radius,
    );

    const startFloor = positiveSlope
      ? Math.floor(startPoint.y - radius) + 1
      : Math.ceil(startPoint.y + radius) - 1;

    const rightGuide = {
      x: isFinite(tan)
        ? rightTangent.x + (startFloor - rightTangent.y) * tan
        : rightTangent.x - radius,
      y: startFloor,
    };
    const leftGuide = {
      x: isFinite(tan)
        ? leftTangent.x - (leftTangent.y - startFloor) * tan
        : leftTangent.x - radius,
      y: startFloor,
    };

    const guide = Math.max(rightGuide.x, leftGuide.x);
    const guideDistance = Math.abs(rightGuide.x - leftGuide.x);

    const absTan = Math.abs(tan);
    const totalShift = isFinite(absTan)
      ? absTan + guideDistance
      : guideDistance;

    let xStartRaw = guide - totalShift;
    for (let y = 0; y <= ySteps; y++) {
      const xEndRaw = xStartRaw + (isFinite(absTan) ? totalShift : Infinity);

      const xStartTest = Math.floor(xStartRaw);
      const xEndTest = Math.floor(xEndRaw);

      // Imagine an entity going right:
      // 0110
      // 1111
      // 1111
      // 0110
      // We don't want to check the top-left or bottom-left tiles
      const xStartMin = xStartRaw < startPoint.x &&
          behind(
            leftTangent,
            rightTangent,
            xStartTest + 1,
            yStart + y * yStep,
          )
        ? trueMinX(
          startPoint,
          radius,
          yStart + y * yStep,
          Math.max(xStartTest, minX),
        )
        : -Infinity;

      // Similar to the above, but to the left of the end location
      const xEndMin = xStartRaw < endPoint.x &&
          infront(
            endLeftTangent,
            endRightTangent,
            xStartTest - 1,
            yStart + y * yStep,
          )
        ? trueMinX(
          endPoint,
          radius,
          yStart + y * yStep,
          Math.max(xStartTest, minX),
        )
        : -Infinity;

      const xStart = Math.max(xStartMin, xEndMin, xStartTest, minX);

      // Similar to the above, but to the right of the start location
      const xStartMax = xEndRaw > startPoint.x &&
          behind(
            leftTangent,
            rightTangent,
            xEndTest + 1,
            yStart + y * yStep,
          )
        ? trueMaxX(
          startPoint,
          radius,
          yStart + y * yStep,
          Math.min(xEndTest, maxX),
        )
        : Infinity;

      // Similar to the above, but to the right of the end location
      const xEndMax = xEndRaw > endPoint.x &&
          infront(
            endLeftTangent,
            endRightTangent,
            xEndTest - 1,
            yStart + y * yStep,
          )
        ? trueMaxX(
          endPoint,
          radius,
          yStart + y * yStep,
          Math.min(xEndTest, maxX),
        )
        : Infinity;

      const xEnd = Math.min(xStartMax, xEndMax, xEndTest, maxX);

      for (let x = xStart; x <= xEnd; x++) {
        if (!this.grid[yStart + y * yStep]?.[x]?.pathable(pathing)) {
          return false;
        }
      }

      xStartRaw += isFinite(absTan) ? absTan : 0;
    }

    return true;
  }

  /**
   * Adds an entity to the PathingMap, adding it to any tiles it intersects
   * with.
   */
  addEntity(entity: PathingEntity): void {
    const tiles = [];
    const position = entity.position;
    const { map, top, left, width, height } = entity.tilemap ??
      this.pointToTilemap(position.x, position.y, entity.radius, {
        type: entity.blocksPathing ?? entity.pathing,
      });
    const tileX = this.xWorldToTile(position.x);
    const tileY = this.yWorldToTile(position.y);
    for (let y = top; y < top + height; y++) {
      for (let x = left; x < left + width; x++) {
        if (!this.grid[tileY + y]?.[tileX + x]) continue;
        tiles.push(this.grid[tileY + y][tileX + x]);
        this.grid[tileY + y][tileX + x].addEntity(
          entity,
          map[(y - top) * width + (x - left)],
        );
      }
    }

    this.entities.set(entity, tiles);
  }

  /**
   * Notifies the PathingMap the entity may occupy a new tiles, removing
   * it from tiles it no longer intersects and adding it to tiles it now
   * intersects.
   * Note: This will not reflect changes to the entity's pathing type. An
   * entity's pathing type is treated as immutable.
   */
  updateEntity(entity: PathingEntity): void {
    if (!this.entities.has(entity)) return;
    const oldTiles: Tile[] = this.entities.get(entity) ?? [];
    const newTiles: Tile[] = [];
    const position = entity.position;
    const { map, top, left, width, height } = entity.tilemap ??
      this.pointToTilemap(position.x, position.y, entity.radius, {
        type: entity.blocksPathing ?? entity.pathing,
      });
    const tileX = this.xWorldToTile(position.x);
    const tileY = this.yWorldToTile(position.y);
    for (let y = top; y < top + height; y++) {
      for (let x = left; x < left + width; x++) {
        newTiles.push(this.grid[tileY + y][tileX + x]);
      }
    }

    // Tiles that the entity no longer occupies
    oldTiles
      .filter((t) => !newTiles.includes(t))
      .forEach((tile) => tile.removeEntity(entity));

    newTiles.forEach((tile, index) => {
      // Tiles the entity continues to occupy
      if (oldTiles.includes(tile)) tile.updateEntity(entity, map[index]);
      // Tiles the entity now occupies
      else tile.addEntity(entity, map[index]);
    });

    this.entities.set(entity, newTiles);
  }

  /**
   * Removes the entity from the PathingMap, clearing it from all tiles.
   */
  removeEntity(entity: Entity): void {
    const tiles = this.entities.get(entity as PathingEntity);
    if (tiles) tiles.forEach((tile) => tile.removeEntity(entity));
    this.entities.delete(entity as PathingEntity);
  }

  // paint(): void {
  // 	const host =
  // 		this._elem ||
  // 		(this._elem = (() => {
  // 			const elem = document.createElement("div");
  // 			arena.appendChild(elem);

  // 			return elem;
  // 		})());

  // 	emptyElement(host);
  // 	const cellSize = 32 / this.resolution;

  // 	for (let y = 0; y < this.heightMap; y++)
  // 		for (let x = 0; x < this.widthMap; x++) {
  // 			const cell = document.createElement("div");
  // 			Object.assign(cell.style, {
  // 				zIndex: 10,
  // 				position: "absolute",
  // 				top: `${y * cellSize}px`,
  // 				left: `${x * cellSize}px`,
  // 				width: `${cellSize}px`,
  // 				height: `${cellSize}px`,
  // 				background: `rgba(${
  // 					this.grid[y][x].pathing & 1 ? 255 : 0
  // 				}, 0, ${this.grid[y][x].pathing & 2 ? 255 : 0}, 0.4)`,
  // 			});
  // 			host.appendChild(cell);
  // 		}
  // }

  // paintMap(map: Footprint, xTile: number, yTile: number): void {
  // 	const host =
  // 		this._elem ||
  // 		(this._elem = (() => {
  // 			const elem = document.createElement("div");
  // 			arena.appendChild(elem);

  // 			return elem;
  // 		})());

  // 	const cellSize = 32 / this.resolution;

  // 	let i = 0;

  // 	for (let y = yTile + map.top; y < yTile + map.height + map.top; y++)
  // 		for (
  // 			let x = xTile + map.left;
  // 			x < xTile + map.width + map.left;
  // 			x++, i++
  // 		) {
  // 			const cell = document.createElement("div");
  // 			Object.assign(cell.style, {
  // 				zIndex: 10,
  // 				position: "absolute",
  // 				top: `${y * cellSize}px`,
  // 				left: `${x * cellSize}px`,
  // 				width: `${cellSize}px`,
  // 				height: `${cellSize}px`,
  // 				background:
  // 					this.grid[y] === undefined ||
  // 					this.grid[y][x] === undefined ||
  // 					this.grid[y][x].pathing & map.map[i]
  // 						? "rgba(255,0,0,0.5)"
  // 						: "rgba(0,255,0,0.5)",
  // 			});
  // 			cell.setAttribute("x", x.toString());
  // 			cell.setAttribute("y", y.toString());
  // 			cell.setAttribute("i", i.toString());
  // 			cell.setAttribute(
  // 				"grid",
  // 				(this.grid[y] === undefined
  // 					? "no-y"
  // 					: this.grid[y][x] === undefined
  // 					? "no-x"
  // 					: this.grid[y][x].pathing
  // 				).toString(),
  // 			);
  // 			cell.setAttribute("map", map.map[i].toString());
  // 			host.appendChild(cell);
  // 		}
  // }
}
