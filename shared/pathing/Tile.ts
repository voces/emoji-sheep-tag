import { Entity } from "../types.ts";
import { Pathing, PathingEntity } from "./types.ts";

export class Tile {
  x: number;
  y: number;
  world: { x: number; y: number };
  /** The pathing of the tile without any entities on top of it. */
  originalPathing: Pathing;
  pathing: Pathing;
  nodes: Tile[];

  // nearestPathing
  __np?: number;
  __npTag?: number;

  // path
  __startRealPlusEstimatedCost?: number;
  __startTag?: number;
  __startRealCostFromOrigin?: number;
  __startEstimatedCostRemaining?: number;
  __startVisited?: boolean;
  __startClosed?: boolean;
  __startParent?: Tile | null;
  __endRealPlusEstimatedCost?: number;
  __endTag?: number;
  __endRealCostFromOrigin?: number;
  __endEstimatedCostRemaining?: number;
  __endVisited?: boolean;
  __endClosed?: boolean;
  __endParent?: Tile | null;

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
    this.world = { x: xWorld, y: yWorld };
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
    // console.log("set tile", this.x, this.y, "to", this.pathing);
  }

  pathable(pathing: Pathing): boolean {
    return (this.pathing & pathing) === 0;
  }
}
