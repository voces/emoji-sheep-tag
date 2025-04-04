import { Entity } from "../types.ts";
import { PathingEntity } from "./types.ts";

export const isPathingEntity = (entity: Entity): entity is PathingEntity =>
  !!entity.position && typeof entity.radius === "number" && !entity.isDoodad;
