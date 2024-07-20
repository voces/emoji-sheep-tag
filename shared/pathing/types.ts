import { SystemEntity } from "jsr:@verit/ecs";
import { Entity as CommonEntity } from "../types.ts";

export type Pathing = number;

export type Point = { x: number; y: number };

export type Footprint = {
  top: number;
  left: number;
  height: number;
  width: number;
  map: number[];
};

export type PathingEntity = SystemEntity<CommonEntity, "position" | "radius">;
