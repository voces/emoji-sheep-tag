import { entityPoints, Point } from "./math.ts";
import { PathingEntity, TargetEntity } from "./types.ts";

/**
 * PathingMap#withinDistanceFromTarget for one search: whether an entity placed
 * at a tile is within `distanceFromTarget` of the target. distanceBetweenEntities
 * recomputes both footprints' corner points on every call; here they are
 * computed once and offset to each tile, giving the same answers.
 *
 * The points are computed at the first call that needs them, as
 * distanceBetweenEntities would, not up front: entityPoints memoises a
 * footprint by radius alone, so computing one earlier could decide what that
 * memo holds for other entities.
 */
export class DistanceCheck {
  /** Corner points of the entity's footprint at tile (0, 0), flat x, y. */
  self?: Float64Array;
  /** Corner points of the target's footprint, flat x, y. */
  target?: Float64Array;
  readonly max: number;
  readonly early: boolean;
  readonly targetX: number;
  readonly targetY: number;
  readonly entityRadius: number;
  readonly targetRadius: number;

  constructor(
    private readonly entity: Pick<
      PathingEntity,
      "id" | "radius" | "tilemap" | "pathing"
    >,
    private readonly targetEntity: TargetEntity | undefined,
    readonly point: Point | undefined,
    /** distanceFromTarget, in tiles. */
    readonly limit: number,
    readonly resolution: number,
  ) {
    this.max = limit / resolution;
    this.targetX = targetEntity?.position.x ?? 0;
    this.targetY = targetEntity?.position.y ?? 0;
    this.entityRadius = entity.radius;
    this.targetRadius = targetEntity?.radius ?? 0;
    this.early = !!(entity.radius && targetEntity?.radius);
  }

  /** Computes the footprints' points if a call has not yet needed them. */
  loadPoints() {
    if (this.self) return;
    this.self = Float64Array.from(
      entityPoints({ ...this.entity, position: { x: 0, y: 0 } }),
    );
    // distanceBetweenEntities gives up before the target's points when the
    // entity has none
    this.target = Float64Array.from(
      this.self.length ? entityPoints(this.targetEntity!) : [],
    );
  }

  within(tile: number, width: number): boolean {
    const x = (tile % width) / this.resolution;
    const y = Math.floor(tile / width) / this.resolution;
    if (this.point) {
      return ((x - this.point.x) ** 2 + (y - this.point.y) ** 2) ** 0.5 *
          this.resolution < this.limit;
    }
    return this.distance(x, y) * this.resolution < this.limit;
  }

  private distance(x: number, y: number): number {
    if (this.early) {
      const cdx = x - this.targetX;
      const cdy = y - this.targetY;
      const centerDist = (cdx * cdx + cdy * cdy) ** 0.5;
      if (
        centerDist - this.entityRadius - this.targetRadius > this.max + 1
      ) return Infinity;
    }
    this.loadPoints();
    const self = this.self!;
    const target = this.target!;
    if (!self.length || !target.length) return Infinity;

    // entityPoints offsets a footprint from its tile's corner
    const ox = Math.floor(x * 4) / 4;
    const oy = Math.floor(y * 4) / 4;
    let minSq = Infinity;
    for (let i = 0; i < self.length; i += 2) {
      const ax = self[i] + ox;
      const ay = self[i + 1] + oy;
      for (let j = 0; j < target.length; j += 2) {
        const dx = ax - target[j];
        const dxSq = dx * dx;
        if (dxSq >= minSq) continue;
        const dy = ay - target[j + 1];
        const dSq = dxSq + dy * dy;
        if (dSq < minSq) minSq = dSq;
      }
    }
    return minSq ** 0.5;
  }
}
