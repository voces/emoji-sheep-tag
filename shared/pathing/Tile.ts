import { Entity } from "../types.ts";
import { Pathing, PathingEntity } from "./types.ts";
import type { FlatGrid } from "./FlatGrid.ts";

export class Tile {
  x: number;
  y: number;
  xWorld: number;
  yWorld: number;
  /** This tile's index into `grid`. */
  readonly index: number;
  private readonly grid: FlatGrid;
  nodes: Tile[];

  // nearestPathing
  __np?: number;
  __npTag?: number;

  /** Maps an entity to their pathing on this tile */
  entities: Map<PathingEntity, Pathing> = new Map();

  constructor(
    xTile: number,
    yTile: number,
    xWorld: number,
    yWorld: number,
    pathing: Pathing,
    grid: FlatGrid,
  ) {
    this.x = xTile;
    this.y = yTile;
    this.xWorld = xWorld;
    this.yWorld = yWorld;
    this.grid = grid;
    this.index = yTile * grid.width + xTile;
    grid.create(this.index, pathing);
    this.nodes = [];
  }

  /** The pathing of the tile without any entities on top of it. */
  get originalPathing(): Pathing {
    return this.grid.original[this.index];
  }
  set originalPathing(pathing: Pathing) {
    this.grid.setOriginal(this.index, pathing);
  }

  get pathing(): Pathing {
    return this.grid.pathing[this.index];
  }

  addEntity(entity: PathingEntity, pathing: Pathing): void {
    const previous = this.entities.get(entity);
    if (previous !== undefined) this.grid.remove(this.index, previous);
    this.entities.set(entity, pathing);
    this.grid.add(this.index, pathing);
  }

  removeEntity(entity: Entity): void {
    const previous = this.entities.get(entity as PathingEntity);
    if (previous === undefined) return;
    this.entities.delete(entity as PathingEntity);
    this.grid.remove(this.index, previous);
  }

  updateEntity(entity: PathingEntity, pathing: Pathing): void {
    if (this.entities.get(entity) === pathing) return;
    this.addEntity(entity, pathing);
  }

  pathable(pathing: Pathing): boolean {
    return (this.pathing & pathing) === 0;
  }
}
