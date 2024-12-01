import { SystemEntity } from "jsr:@verit/ecs";
import { Entity } from "../types.ts";

export type Pathing = number;

export type Footprint = {
  top: number;
  left: number;
  height: number;
  width: number;
  map: number[];
};

export type PathingEntity = SystemEntity<Entity, "position" | "radius">;
export type TargetEntity = SystemEntity<Entity, "position">;
