import { Entity } from "@/shared/types.ts";
import { Footprint } from "@/shared/pathing/types.ts";
import {
  facingToQuadrant,
  getRotatedFootprint,
  isRotationOf,
} from "@/shared/pathing/rotateFootprint.ts";

export const applyTilemapRotation = (
  originals: WeakMap<Entity, Footprint>,
  e: Entity,
) => {
  if (!e.tilemap) return;
  const stored = originals.get(e);
  const original = stored && isRotationOf(e.tilemap, stored)
    ? stored
    : e.tilemap;
  if (original !== stored) originals.set(e, original);
  const rotated = getRotatedFootprint(original, facingToQuadrant(e.facing));
  if (e.tilemap !== rotated) e.tilemap = rotated;
};
