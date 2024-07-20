import { Entity } from "./types.ts";

export const unitData: Record<
  string,
  Pick<Entity, "movementSpeed" | "radius" | "pathing" | "tilemap"> | undefined
> = {
  sheep: {
    movementSpeed: 3,
    radius: 0.25,
    pathing: 1,
  },
  wolf: {
    movementSpeed: 3.1,
    radius: 0.5,
    pathing: 1,
  },
  hut: {
    radius: 1,
    tilemap: {
      map: Array(16).fill(1),
      top: -2,
      left: -2,
      width: 4,
      height: 4,
    },
  },
};

export const BUILD_RADIUS = 0.75;
