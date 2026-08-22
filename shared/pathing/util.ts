import { Entity, Order } from "../types.ts";
import { PathingEntity } from "./types.ts";

type MovingEntity = Entity & {
  order: Order & { path: ReadonlyArray<{ x: number; y: number }> };
};

export const isPathingEntity = (entity: Entity): entity is PathingEntity =>
  !!entity.position &&
  ((typeof entity.radius === "number" && typeof entity.pathing === "number") ||
    !!entity.tilemap);

/** Whether the entity is advancing along a path, and so expected to move off. */
export const isMoving = (entity: Entity): entity is MovingEntity =>
  !!entity.order && "path" in entity.order && !!entity.order.path?.length;
