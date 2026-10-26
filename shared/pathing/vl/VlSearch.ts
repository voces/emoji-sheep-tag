import { FlatGrid } from "../FlatGrid.ts";
import type { SearchEngine, SearchParams } from "../FlatSearch.ts";

/**
 * The SearchEngine compiled from VL (`search.vl`). The grid lives in the
 * module's memory, where FlatGrid's views keep it current with no calls into
 * wasm; a search is a handful of calls. Off unless PATHING_WASM=1 or
 * `setWasmPathing(true)`, and only where Deno can read the module file.
 */

type Exports = {
  memory: WebAssembly.Memory;
  init(width: number, height: number): number;
  footprintAddress(): number;
  outAddress(): number;
  prepare(
    pathing: number,
    top: number,
    left: number,
    width: number,
    height: number,
    radius: number,
    radiusTileOffset: number,
    budget: number,
    ownerSpent: number,
    owned: number,
  ): void;
  setDistance(
    mode: number,
    limit: number,
    resolution: number,
    x: number,
    y: number,
    max: number,
    radius: number,
    otherRadius: number,
    early: number,
  ): void;
  selfPointsAddress(): number;
  targetPointsAddress(): number;
  pointCapacity(): number;
  setDistancePoints(self: number, target: number, overflow: number): void;
  pathable(x: number, y: number): number;
  begin(
    side: number,
    tag: number,
    best: number,
    goalX: number,
    goalY: number,
  ): void;
  seed(side: number, tile: number, g: number, h: number): void;
  best(side: number): number;
  setBest(side: number, tile: number): void;
  endReached(tile: number): number;
  endTop(): number;
  markEnd(tile: number): void;
  run(startTile: number): number;
  spent(): number;
  path(): number;
};

const FOOTPRINT_CELLS = 4096;

let enabled = typeof Deno !== "undefined" &&
  Deno.env.get("PATHING_WASM") === "1";
let module: WebAssembly.Module | undefined;

export const setWasmPathing = (on: boolean) => void (enabled = on);
export const wasmPathingEnabled = () => enabled;

export class VlSearch implements SearchEngine {
  readonly grid: FlatGrid;
  private readonly exports: Exports;
  private params?: SearchParams;
  private readonly footprint: Int32Array;
  private readonly out: Int32Array;

  constructor(width: number, height: number) {
    module ??= new WebAssembly.Module(
      Deno.readFileSync(new URL("./search.wasm", import.meta.url)),
    );
    const imports: Record<string, Record<string, unknown>> = {
      extern: {
        withinDistance: (tile: number) =>
          this.params?.distance?.within(tile, width) ? 1 : 0,
        reopenEnd: () => this.params?.reopenEnd(),
        loadDistancePoints: () => this.loadDistancePoints(),
      },
    };
    // The module declares print sinks it never calls
    for (
      const { module: name, name: field } of WebAssembly.Module.imports(module)
    ) {
      (imports[name] ??= {})[field] ??= () => {};
    }
    this.exports = new WebAssembly.Instance(
      module,
      imports as WebAssembly.Imports,
    )
      .exports as Exports;
    const base = this.exports.init(width, height);
    const buffer = this.exports.memory.buffer;
    this.grid = new FlatGrid(width, height, buffer, base);
    this.footprint = new Int32Array(
      buffer,
      this.exports.footprintAddress(),
      FOOTPRINT_CELLS,
    );
    this.out = new Int32Array(
      buffer,
      this.exports.outAddress(),
      width * height,
    );
  }

  get spent() {
    return this.exports.spent();
  }

  prepare(params: SearchParams) {
    this.params = params;
    const { minimalTilemap: map } = params;
    if (map.map.length > FOOTPRINT_CELLS) {
      throw new Error(`Footprint of ${map.map.length} cells is too large`);
    }
    this.footprint.set(map.map);
    this.exports.prepare(
      params.pathing,
      map.top,
      map.left,
      map.width,
      map.height,
      params.radius,
      params.radiusTileOffset,
      params.unitBudget,
      params.ownerSpent ?? 0,
      params.ownerSpent === undefined ? 0 : 1,
    );
    const { distance } = params;
    if (distance) {
      this.exports.setDistance(
        distance.point ? 1 : 2,
        distance.limit,
        distance.resolution,
        distance.point?.x ?? distance.targetX,
        distance.point?.y ?? distance.targetY,
        distance.max,
        distance.entityRadius,
        distance.targetRadius,
        distance.early ? 1 : 0,
      );
    }
  }

  private loadDistancePoints() {
    const distance = this.params?.distance;
    if (!distance) return;
    distance.loadPoints();
    const self = distance.self!;
    const target = distance.target!;
    const capacity = this.exports.pointCapacity();
    if (self.length > capacity || target.length > capacity) {
      this.exports.setDistancePoints(0, 0, 1);
      return;
    }
    const buffer = this.exports.memory.buffer;
    new Float64Array(buffer, this.exports.selfPointsAddress(), self.length)
      .set(self);
    new Float64Array(buffer, this.exports.targetPointsAddress(), target.length)
      .set(target);
    this.exports.setDistancePoints(self.length, target.length, 0);
  }

  pathable(x: number, y: number) {
    return this.exports.pathable(x, y) !== 0;
  }

  begin(side: 0 | 1, tag: number, best: number, goalX: number, goalY: number) {
    this.exports.begin(side, tag, best, goalX, goalY);
  }

  seed(side: 0 | 1, tile: number, g: number, h: number) {
    this.exports.seed(side, tile, g, h);
  }

  best(side: 0 | 1) {
    return this.exports.best(side);
  }

  setBest(side: 0 | 1, tile: number) {
    this.exports.setBest(side, tile);
  }

  endReached(tile: number) {
    return this.exports.endReached(tile) !== 0;
  }

  endTop() {
    return this.exports.endTop();
  }

  markEnd(tile: number) {
    this.exports.markEnd(tile);
  }

  run(startTile: number) {
    // FlatSearch throws reading an undefined heap top; so does this
    if (this.exports.run(startTile)) {
      throw new TypeError("The end side is exhausted");
    }
    return this.exports.spent();
  }

  path(): number[] {
    const length = this.exports.path();
    const tiles = new Array<number>(length);
    for (let i = 0; i < length; i++) tiles[i] = this.out[i];
    return tiles;
  }
}
