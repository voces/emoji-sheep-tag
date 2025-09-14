import { Entity } from "../types.ts";
import { PathingEntity } from "./types.ts";

export const isPathingEntity = (entity: Entity): entity is PathingEntity =>
  // TODO: this isDoodad check is wonky
  !!entity.position && typeof entity.radius === "number";
