import { FlatGrid } from "./FlatGrid.ts";
import { Footprint, Pathing } from "./types.ts";
import type { DistanceCheck } from "./DistanceCheck.ts";

/**
 * PathingMap#path's bidirectional Theta* over a FlatGrid, with each tile's
 * search state in typed arrays instead of on Tile objects. It reproduces the
 * object version exactly, quirks included: state left from an earlier search
 * is read where the object version read it, the heap keeps duplicate entries,
 * and tiles are created in the same order, since an uncreated tile blocks line
 * of sight.
 */

type Side = 0 | 1;

const VISITED = 1;
const CLOSED = 2;

/** A binary heap of tile indices, ordered as BinaryHeap orders Tiles. */
class TileHeap {
  items: Int32Array;
  scores: Float64Array;
  length = 0;
  /** Where each tile last sat in the heap, or -1; BinaryHeap's indexMap. */
  readonly position: Int32Array;

  constructor(size: number, private readonly score: Float64Array) {
    this.items = new Int32Array(64);
    this.scores = new Float64Array(64);
    this.position = new Int32Array(size).fill(-1);
  }

  clear() {
    for (let i = 0; i < this.length; i++) this.position[this.items[i]] = -1;
    this.length = 0;
  }

  push(tile: number) {
    if (this.length === this.items.length) {
      const items = new Int32Array(this.length * 2);
      items.set(this.items);
      this.items = items;
      const scores = new Float64Array(this.length * 2);
      scores.set(this.scores);
      this.scores = scores;
    }
    const index = this.length++;
    this.items[index] = tile;
    this.position[tile] = index;
    this.bubbleUp(index);
  }

  pop(): number {
    const top = this.items[0];
    const end = this.length - 1;
    this.position[top] = -1;
    if (end > 0) {
      const bottom = this.items[end];
      this.length--;
      this.items[0] = bottom;
      this.scores[0] = this.scores[end];
      this.position[bottom] = 0;
      this.sinkDown(0);
    } else this.length--;
    return top;
  }

  decrease(tile: number) {
    const index = this.position[tile];
    if (index !== -1) this.bubbleUp(index);
  }

  private bubbleUp(index: number) {
    const element = this.items[index];
    const score = this.score[element];
    this.scores[index] = score;
    while (index > 0) {
      const parentIndex = ((index + 1) >> 1) - 1;
      const parentScore = this.scores[parentIndex];
      if (score >= parentScore) break;
      const parent = this.items[parentIndex];
      this.items[parentIndex] = element;
      this.items[index] = parent;
      this.scores[parentIndex] = score;
      this.scores[index] = parentScore;
      this.position[parent] = index;
      index = parentIndex;
    }
    this.position[element] = index;
  }

  private sinkDown(index: number) {
    const length = this.length;
    const element = this.items[index];
    const score = this.score[element];
    this.scores[index] = score;
    while (true) {
      const rightIndex = (index + 1) * 2;
      const leftIndex = rightIndex - 1;
      let swapIndex = -1;
      let swapScore = score;
      if (leftIndex < length) {
        const leftScore = this.scores[leftIndex];
        if (leftScore < swapScore) {
          swapIndex = leftIndex;
          swapScore = leftScore;
        }
      }
      if (rightIndex < length) {
        const rightScore = this.scores[rightIndex];
        if (rightScore < swapScore) swapIndex = rightIndex;
      }
      if (swapIndex === -1) break;
      const swapped = this.items[swapIndex];
      const swappedScore = this.scores[swapIndex];
      this.items[index] = swapped;
      this.items[swapIndex] = element;
      this.scores[index] = swappedScore;
      this.scores[swapIndex] = score;
      this.position[swapped] = index;
      index = swapIndex;
    }
    this.position[element] = index;
  }
}

/**
 * A map from ordered tile pairs to booleans, cleared in O(1). Line of sight is
 * memoised per search and the memo is load-bearing: the search creates tiles
 * as it goes, and an uncreated tile blocks, so asking again can answer
 * differently.
 */
class PairCache {
  /** Four i32s per slot: tag, a, b, answer. */
  private table = new Int32Array(4096 * 4);
  private slots = 4096;
  private current = 1;
  private count = 0;

  clear() {
    this.current++;
    this.count = 0;
  }

  private slot(a: number, b: number) {
    const mask = this.slots - 1;
    const table = this.table;
    let i = (Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca77)) & mask;
    while (
      table[i * 4] === this.current &&
      (table[i * 4 + 1] !== a || table[i * 4 + 2] !== b)
    ) i = (i + 1) & mask;
    return i * 4;
  }

  /** 1 or 0 for a cached answer, -1 for none. */
  get(a: number, b: number): number {
    const slot = this.slot(a, b);
    return this.table[slot] === this.current ? this.table[slot + 3] : -1;
  }

  set(a: number, b: number, value: boolean) {
    if ((this.count + 1) * 2 > this.slots) this.grow();
    this.store(a, b, value ? 1 : 0);
  }

  private store(a: number, b: number, value: number) {
    const slot = this.slot(a, b);
    if (this.table[slot] !== this.current) this.count++;
    this.table[slot] = this.current;
    this.table[slot + 1] = a;
    this.table[slot + 2] = b;
    this.table[slot + 3] = value;
  }

  private grow() {
    const { table, current } = this;
    this.slots *= 2;
    this.table = new Int32Array(this.slots * 4);
    this.count = 0;
    for (let i = 0; i < table.length; i += 4) {
      if (table[i] === current) {
        this.store(table[i + 1], table[i + 2], table[i + 3]);
      }
    }
  }
}

/** One direction of the search; the arrays persist across searches. */
class SearchSide {
  readonly tag: Int32Array;
  readonly g: Float64Array;
  readonly h: Float64Array;
  readonly f: Float64Array;
  readonly parent: Int32Array;
  readonly flags: Uint8Array;
  readonly heap: TileHeap;
  /** This search's tag; tiles carrying another are reset when touched. */
  current = 0;
  best = 0;
  goalX = 0;
  goalY = 0;

  constructor(size: number) {
    this.tag = new Int32Array(size);
    this.g = new Float64Array(size);
    this.h = new Float64Array(size);
    this.f = new Float64Array(size);
    this.parent = new Int32Array(size).fill(-1);
    this.flags = new Uint8Array(size);
    this.heap = new TileHeap(size, this.f);
  }

  begin(tag: number, best: number, goalX: number, goalY: number) {
    this.heap.clear();
    this.current = tag;
    this.best = best;
    this.goalX = goalX;
    this.goalY = goalY;
  }

  /** searchNode: resets the tile's state if it is left from another search. */
  touch(tile: number) {
    if (this.tag[tile] === this.current) return;
    this.tag[tile] = this.current;
    this.h[tile] = 0;
    this.f[tile] = 0;
    this.g[tile] = 0;
    this.flags[tile] = 0;
    this.parent[tile] = -1;
  }

  seed(tile: number, g: number, h: number) {
    this.touch(tile);
    this.g[tile] = g;
    this.h[tile] = h;
    this.f[tile] = h + g;
    this.flags[tile] = 0;
    this.parent[tile] = -1;
    this.heap.push(tile);
  }
}

/** What PathingMap works out for one search. */
export type SearchParams = {
  pathing: Pathing;
  minimalTilemap: Footprint;
  /** Line-of-sight radius and offset, in tiles. */
  radius: number;
  radiusTileOffset: number;
  /** Whether the start side may stop at a tile, for distanceFromTarget. */
  distance?: DistanceCheck;
  /** Restarts the exhausted end side; see PathingMap#reopenEndSide. */
  reopenEnd: () => void;
  unitBudget: number;
  /** Iterations the owner has spent this tick, or undefined for no owner. */
  ownerSpent: number | undefined;
};

export const START = 0;
export const END = 1;

export class FlatSearch {
  readonly start: SearchSide;
  readonly end: SearchSide;
  private readonly width: number;
  private readonly height: number;
  private readonly size: number;
  private readonly losCache = new PairCache();
  private readonly pathableTag: Int32Array;
  private readonly pathableResult: Uint8Array;
  private searchTag = 0;
  private params!: SearchParams;

  constructor(readonly grid: FlatGrid) {
    this.width = grid.width;
    this.height = grid.height;
    this.size = grid.width * grid.height;
    this.start = new SearchSide(this.size);
    this.end = new SearchSide(this.size);
    this.pathableTag = new Int32Array(this.size);
    this.pathableResult = new Uint8Array(this.size);
    this.endMark = new Int32Array(this.size);
  }

  private side(side: Side) {
    return side === START ? this.start : this.end;
  }

  begin(side: Side, tag: number, best: number, goalX: number, goalY: number) {
    this.side(side).begin(tag, best, goalX, goalY);
  }

  seed(side: Side, tile: number, g: number, h: number) {
    this.side(side).seed(tile, g, h);
  }

  best(side: Side) {
    return this.side(side).best;
  }

  setBest(side: Side, tile: number) {
    this.side(side).best = tile;
  }

  endReached(tile: number) {
    return this.end.tag[tile] === this.end.current;
  }

  endTop() {
    return this.end.heap.length ? this.end.heap.items[0] : -1;
  }

  /** Tiles marked with this search's tag end the search. */
  private readonly endMark: Int32Array;

  markEnd(tile: number) {
    this.endMark[tile] = this.searchTag;
  }

  path(): number[] {
    const tiles = this.join();
    this.smooth(tiles);
    return tiles;
  }

  /** Starts a search, clearing the per-search caches. */
  prepare(params: SearchParams) {
    this.params = params;
    this.searchTag++;
    this.losCache.clear();
  }

  /** PathingMap#_pathable for the search's minimal tilemap, cached. */
  pathable(x: number, y: number): boolean {
    const key = x * this.height + y;
    // The cache key, like the object version's, can alias tiles off the map;
    // only an on-map key is memoised there, so the rest are computed each time
    if (key >= 0 && key < this.size) {
      if (this.pathableTag[key] === this.searchTag) {
        return this.pathableResult[key] === 1;
      }
      const result = this.footprintPathable(x, y);
      this.pathableTag[key] = this.searchTag;
      this.pathableResult[key] = result ? 1 : 0;
      return result;
    }
    return this.footprintPathable(x, y);
  }

  private footprintPathable(xTile: number, yTile: number): boolean {
    const { width, height, grid } = this;
    if (xTile < 0 || yTile < 0 || xTile >= width || yTile >= height) {
      return false;
    }
    const map = this.params.minimalTilemap;
    let i = 0;
    for (let y = yTile + map.top; y < yTile + map.height + map.top; y++) {
      for (
        let x = xTile + map.left;
        x < xTile + map.width + map.left;
        x++, i++
      ) {
        if (y < 0 || y >= height || x < 0 || x >= width) return false;
        const index = y * width + x;
        if (!grid.ensure(index)) return false;
        if ((grid.pathing[index] & map.map[i]) !== 0) return false;
      }
    }
    return true;
  }

  /** The search's line of sight between two tiles, cached. */
  linearPathable(a: number, b: number): boolean {
    const cached = this.losCache.get(a, b);
    if (cached !== -1) return cached === 1;
    const result = this.lineOfSight(a, b);
    this.losCache.set(a, b, result);
    return result;
  }

  /** PathingMap#_linearPathable, reading the flat grid. */
  lineOfSight(a: number, b: number): boolean {
    const { width, height } = this;
    const pathingGrid = this.grid.pathing;
    const { radius, pathing, radiusTileOffset } = this.params;

    let startX = (a % width) + radiusTileOffset;
    let startY = Math.floor(a / width) + radiusTileOffset;
    let endX = (b % width) + radiusTileOffset;
    let endY = Math.floor(b / width) + radiusTileOffset;

    if (
      Math.floor(startX) === Math.floor(endX) &&
      Math.floor(startY) === Math.floor(endY)
    ) {
      const x = Math.floor(startX);
      const y = Math.floor(startY);
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      const cell = pathingGrid[y * width + x];
      return cell !== -1 && (cell & pathing) === 0;
    }

    if (startX > endX) {
      const tmpX = startX;
      const tmpY = startY;
      startX = endX;
      startY = endY;
      endX = tmpX;
      endY = tmpY;
    }

    const dx = endX - startX;
    const dy = endY - startY;
    const dist = (dx * dx + dy * dy) ** 0.5;
    const cosA = dx / dist;
    const sinA = dy / dist;
    const tan = dx / dy;
    const positiveSlope = endY > startY;

    const minY = positiveSlope
      ? Math.floor(startY - radius)
      : Math.floor(endY - radius);
    const maxY = positiveSlope
      ? Math.floor(endY + radius)
      : Math.floor(startY + radius);
    const yStart = positiveSlope ? minY : maxY;
    const yStep = positiveSlope ? 1 : -1;
    const ySteps = Math.abs(minY - maxY);

    const minX = Math.floor(startX - radius);
    const maxX = Math.floor(endX + radius);

    const sinAR = sinA * radius;
    const cosAR = cosA * radius;
    const leftTangentX = startX + sinAR;
    const leftTangentY = startY - cosAR;
    const rightTangentX = startX - sinAR;
    const rightTangentY = startY + cosAR;
    const endLeftTangentX = endX + sinAR;
    const endLeftTangentY = endY - cosAR;
    const tangentDy = 2 * cosAR;
    const tangentDx = -2 * sinAR;
    const radiusSq = radius * radius;

    const startFloor = positiveSlope
      ? Math.floor(startY - radius) + 1
      : Math.ceil(startY + radius) - 1;

    const rightGuideX = isFinite(tan)
      ? rightTangentX + (startFloor - rightTangentY) * tan
      : rightTangentX - radius;
    const leftGuideX = isFinite(tan)
      ? leftTangentX - (leftTangentY - startFloor) * tan
      : leftTangentX - radius;

    const guide = Math.max(rightGuideX, leftGuideX);
    const guideDistance = Math.abs(rightGuideX - leftGuideX);
    const absTan = Math.abs(tan);
    const finiteAbsTan = isFinite(absTan);
    const totalShift = finiteAbsTan ? absTan + guideDistance : guideDistance;

    let xStartRaw = guide - totalShift;
    for (let y = 0; y <= ySteps; y++) {
      const xEndRaw = xStartRaw + (finiteAbsTan ? totalShift : Infinity);
      const xStartTest = Math.floor(xStartRaw);
      const xEndTest = Math.floor(xEndRaw);
      const yCoord = yStart + y * yStep;

      const xStartMin = xStartRaw < startX &&
          (xStartTest + 1 - leftTangentX) * tangentDy -
                (yCoord - leftTangentY) * tangentDx < 0
        ? trueMinX(startX, startY, radiusSq, yCoord, Math.max(xStartTest, minX))
        : -Infinity;
      const xEndMin = xStartRaw < endX &&
          (xStartTest - 1 - endLeftTangentX) * tangentDy -
                (yCoord - endLeftTangentY) * tangentDx > 0
        ? trueMinX(endX, endY, radiusSq, yCoord, Math.max(xStartTest, minX))
        : -Infinity;
      const xStart = Math.max(xStartMin, xEndMin, xStartTest, minX);

      const xStartMax = xEndRaw > startX &&
          (xEndTest + 1 - leftTangentX) * tangentDy -
                (yCoord - leftTangentY) * tangentDx < 0
        ? trueMaxX(startX, startY, radiusSq, yCoord, Math.min(xEndTest, maxX))
        : Infinity;
      const xEndMax = xEndRaw > endX &&
          (xEndTest - 1 - endLeftTangentX) * tangentDy -
                (yCoord - endLeftTangentY) * tangentDx > 0
        ? trueMaxX(endX, endY, radiusSq, yCoord, Math.min(xEndTest, maxX))
        : Infinity;
      const xEnd = Math.min(xStartMax, xEndMax, xEndTest, maxX);

      if (yCoord < 0 || yCoord >= height) return false;
      if (xStart <= xEnd) {
        if (xStart < 0 || xEnd >= width) return false;
        const row = yCoord * width;
        for (let i = row + xStart; i <= row + xEnd; i++) {
          const cell = pathingGrid[i];
          if (cell === -1 || (cell & pathing) !== 0) return false;
        }
      }

      xStartRaw += finiteAbsTan ? absTan : 0;
    }

    return true;
  }

  /** Creates the tile's in-bound neighbours, below, right, above, left. */
  private neighbors(tile: number, out: Int32Array): number {
    const { width, height, grid } = this;
    const x = tile % width;
    const y = (tile - x) / width;
    let n = 0;
    if (y + 1 < height && grid.ensure(tile + width)) out[n++] = tile + width;
    if (x + 1 < width && grid.ensure(tile + 1)) out[n++] = tile + 1;
    if (y - 1 >= 0 && grid.ensure(tile - width)) out[n++] = tile - width;
    if (x - 1 >= 0 && grid.ensure(tile - 1)) out[n++] = tile - 1;
    return n;
  }

  private readonly neighborBuffer = new Int32Array(4);

  /** Euclidean distance between two tiles, in tiles. */
  private tileDistance(a: number, b: number) {
    const ax = a % this.width;
    const bx = b % this.width;
    return Math.sqrt(
      (bx - ax) ** 2 + ((b - bx) / this.width - (a - ax) / this.width) ** 2,
    );
  }

  /** PathingMap#expand: closes `current` and relaxes its neighbours. */
  private expand(side: SearchSide, current: number): boolean {
    const { pathing } = this.params;
    const pathingGrid = this.grid.pathing;
    side.touch(current);
    side.flags[current] |= CLOSED;
    const parent = side.parent[current];
    let improved = false;

    const neighbors = this.neighborBuffer;
    const count = this.neighbors(current, neighbors);
    for (let n = 0; n < count; n++) {
      const neighbor = neighbors[n];
      side.touch(neighbor);
      const wasVisited = (side.flags[neighbor] & VISITED) !== 0;

      if (!wasVisited) {
        if (
          (side.flags[neighbor] & CLOSED) !== 0 ||
          (pathingGrid[neighbor] & pathing) !== 0
        ) continue;
        if (
          !this.pathable(
            neighbor % this.width,
            Math.floor(neighbor / this.width),
          )
        ) {
          side.flags[neighbor] |= CLOSED;
          continue;
        }
      }

      const viaParent = parent !== -1 && this.linearPathable(parent, neighbor);
      const via = viaParent ? parent : current;
      const realCostFromOrigin = viaParent
        ? side.g[parent] + this.tileDistance(parent, neighbor)
        : side.g[current] + 1;

      if (wasVisited && !(realCostFromOrigin < side.g[neighbor])) continue;

      side.flags[neighbor] |= VISITED;
      side.parent[neighbor] = via;
      if (!side.h[neighbor]) {
        const nx = neighbor % this.width;
        const ny = (neighbor - nx) / this.width;
        side.h[neighbor] = Math.sqrt(
          (side.goalX - nx) ** 2 + (side.goalY - ny) ** 2,
        );
      }
      side.g[neighbor] = realCostFromOrigin;
      side.f[neighbor] = realCostFromOrigin + side.h[neighbor];

      const best = side.best;
      if (
        side.h[neighbor] < side.h[best] ||
        (side.h[neighbor] === side.h[best] && side.g[neighbor] < side.g[best])
      ) {
        side.best = neighbor;
        improved = true;
      }

      if (wasVisited) side.heap.decrease(neighbor);
      else side.heap.push(neighbor);
    }

    return improved;
  }

  /** The owner's iterations this tick, kept current while `run` runs. */
  spent = 0;

  /**
   * PathingMap#bidirectionalSearch. Leaves each side's `best` as the tile to
   * build from, and `spent` as the owner's iterations.
   */
  run(startTile: number): number {
    const { start, end, params, endMark, searchTag } = this;
    const { unitBudget } = params;
    this.spent = params.ownerSpent ?? 0;
    let checksSinceBestChange = 0;
    let unitIterations = 0;

    while (start.heap.length) {
      if (++checksSinceBestChange > 500) break;

      const overPlayerBudget = params.ownerSpent !== undefined &&
        ++this.spent > PLAYER_PATHING_BUDGET;
      if (++unitIterations > unitBudget || overPlayerBudget) break;

      const startCurrent = start.heap.pop();
      if (endMark[startCurrent] === searchTag) {
        start.best = startCurrent;
        break;
      }
      if (end.tag[startCurrent] === end.current) {
        start.best = end.best = startCurrent;
        break;
      }
      if (params.distance?.within(startCurrent, this.width)) {
        start.best = startCurrent;
        break;
      }
      if (this.expand(start, startCurrent)) checksSinceBestChange = 0;

      if (!end.heap.length) params.reopenEnd();
      // The object version pops undefined here and throws reading it
      if (!end.heap.length) throw new TypeError("The end side is exhausted");
      const endCurrent = end.heap.pop();
      if (endCurrent === startTile) {
        end.best = startTile;
        break;
      }
      if (start.tag[endCurrent] === start.current) {
        start.best = end.best = endCurrent;
        break;
      }
      if (this.expand(end, endCurrent)) checksSinceBestChange = 0;
    }
    return this.spent;
  }

  /** joinSides: the start chain to its best and, if the sides met, on. */
  private join(): number[] {
    const { start, end } = this;
    const tiles: number[] = [];
    for (let tile = start.best; tile !== -1; tile = start.parent[tile]) {
      tiles.unshift(tile);
    }
    if (start.best === end.best) {
      for (let tile = end.parent[start.best]; tile !== -1;) {
        tiles.push(tile);
        tile = end.parent[tile];
      }
    }
    return tiles;
  }

  /** PathingMap#_smooth over tile indices. */
  private smooth(path: number[]) {
    for (let skip = path.length - 1; skip > 1; skip--) {
      for (let index = 0; index < path.length - skip; index++) {
        if (this.linearPathable(path[index], path[index + skip])) {
          path.splice(index + 1, skip - 1);
          skip = path.length;
          break;
        }
      }
    }
  }
}

export const PLAYER_PATHING_BUDGET = 5000;

const trueMinX = (
  px: number,
  py: number,
  radiusSq: number,
  yCoord: number,
  offValue: number,
): number => {
  if (Math.abs(py - yCoord) - 0.5 <= 1) return offValue;
  const yRef = yCoord > py ? yCoord : yCoord + 1;
  const squared = -(py * py) + 2 * py * yRef + radiusSq - yRef * yRef;
  return Math.floor(px - Math.sign(squared) * Math.abs(squared) ** 0.5);
};

const trueMaxX = (
  px: number,
  py: number,
  radiusSq: number,
  yCoord: number,
  offValue: number,
): number => {
  if (Math.abs(py - yCoord) - 0.5 <= 1) return offValue;
  const yRef = yCoord > py ? yCoord : yCoord + 1;
  const squared = -(py * py) + 2 * py * yRef + radiusSq - yRef * yRef;
  return Math.floor(px + Math.sign(squared) * Math.abs(squared) ** 0.5);
};
