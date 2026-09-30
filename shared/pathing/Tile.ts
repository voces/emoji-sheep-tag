import { Entity } from "../types.ts";
import { Pathing, PathingEntity } from "./types.ts";

/** A tile's state within one direction of PathingMap#path's search. */
export type SearchNode = {
  /** The search this state belongs to; any other tag means stale state. */
  tag: number;
  realCostFromOrigin: number;
  estimatedCostRemaining: number;
  realPlusEstimatedCost: number;
  visited: boolean;
  closed: boolean;
  parent: Tile | null;
};

export class Tile {
  x: number;
  y: number;
  xWorld: number;
  yWorld: number;
  /** The pathing of the tile without any entities on top of it. */
  originalPathing: Pathing;
  pathing: Pathing;
  nodes: Tile[];

  // nearestPathing
  __np?: number;
  __npTag?: number;

  // path: one node per search direction, reused across searches
  __start?: SearchNode;
  __end?: SearchNode;

  /** Maps an entity to their pathing on this tile */
  entities: Map<PathingEntity, Pathing> = new Map();

  constructor(
    xTile: number,
    yTile: number,
    xWorld: number,
    yWorld: number,
    pathing: Pathing,
  ) {
    this.x = xTile;
    this.y = yTile;
    this.xWorld = xWorld;
    this.yWorld = yWorld;
    this.pathing = this.originalPathing = pathing;
    this.nodes = [];
  }

  addEntity(entity: PathingEntity, pathing: Pathing): void {
    this.entities.set(entity, pathing);
    this.recalculatePathing();
  }

  removeEntity(entity: Entity): void {
    this.entities.delete(entity as PathingEntity);
    this.recalculatePathing();
  }

  updateEntity(entity: PathingEntity, pathing: Pathing): void {
    if (this.entities.get(entity) === pathing) return;
    this.addEntity(entity, pathing);
  }

  recalculatePathing(): void {
    this.pathing = this.originalPathing;
    this.entities.forEach((pathing) => (this.pathing |= pathing));
  }

  pathable(pathing: Pathing): boolean {
    return (this.pathing & pathing) === 0;
  }
}
