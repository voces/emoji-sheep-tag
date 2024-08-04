import { Entity } from "./types.ts";

export const unitData: Record<
  string,
  | Pick<
    Entity,
    "movementSpeed" | "radius" | "pathing" | "tilemap" | "builds" | "attack"
  >
  | undefined
> = {
  sheep: {
    movementSpeed: 3,
    radius: 0.25,
    pathing: 1,
    builds: ["hut"],
  },
  wolf: {
    movementSpeed: 3.1,
    radius: 0.5,
    pathing: 1,
    attack: {
      damage: 100,
      range: 0.65,
      rangeMotionBuffer: 1,
      cooldown: 1.5,
      damagePoint: 0.5,
    },
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

export const colors: string[] = [
  "#FF0303",
  "#0042FF",
  "#1CE6B9",
  "#540081",
  "#FFFC01",
  "#fEBA0E",
  "#20C000",
  "#E55BB0",
  "#959697",
  "#7EBFF1",
  "#106246",
  "#4E2A04",
  "#9c0000",
  "#0000c3",
  "#00ebff",
  "#bd00ff",
  "#ecce87",
  "#f7a58b",
  "#bfff81",
  "#dbb8eb",
  "#4f5055",
  "#ecf0ff",
  "#00781e",
  "#a56f34",
];
