import { SystemEntity } from "jsr:@verit/ecs";
import { Entity } from "../types.ts";

export type Pathing = number;

export type Footprint = {
  top: number;
  left: number;
  height: number;
  width: number;
  map: ReadonlyArray<number>;
};

export type PathingEntity = SystemEntity<Entity, "position" | "radius">;
export type TargetEntity = SystemEntity<Entity, "position">;

export type PeekingIterator<T> = Iterator<T> & {
  /** Look at the next value without consuming it. */
  peek(): T | undefined;
};
