import { Entity } from "./types.ts";

// The minimum range to hit through corners is (0.125 ** 2 * 2) ** 0.5 * 2,
// ≈0.354 This is because the edge of an entity's circle can be at the very
// center of a its occupied grid cell. A grid cell is 0.25 x 0.25, which means
// the circle can be ((0.25/2)**2*2)**0.5 from the corner. Multiple by two to
// account for both entities.

// The minimum range to hit through corners for entities that are not hard
// pressed against the corners but still occupy them would be
// (0.25 ** 2 * 2) ** 0.5 * 2, ≈0.707. Similar logic as above, but now we may need to
// reach across both entire cells.

export const unitData: Record<
  string,
  | Pick<
    Entity,
    | "movementSpeed"
    | "radius"
    | "pathing"
    | "tilemap"
    | "attack"
    | "maxHealth"
    | "actions"
    | "isDoodad"
  >
  | undefined
> = {
  sheep: {
    movementSpeed: 3,
    radius: 0.25,
    pathing: 1,
    actions: [
      { type: "build", unitType: "tinyHut", binding: ["KeyT"] },
      { type: "build", unitType: "hut", binding: ["KeyF"] },
      { type: "build", unitType: "wideHut", binding: ["KeyW"] },
      { type: "build", unitType: "rotundHut", binding: ["KeyR"] },
      { type: "auto", order: "destroyLastFarm", binding: ["KeyX"] },
    ],
    maxHealth: 20,
  },
  wolf: {
    movementSpeed: 3.1,
    radius: 0.5,
    pathing: 1,
    attack: {
      damage: 100,
      range: 0.31, // roughly minimum to hit via corner now...
      rangeMotionBuffer: 1,
      cooldown: 1.2,
      damagePoint: 0.3,
    },
  },
  hut: {
    radius: 0.5,
    tilemap: { map: Array(16).fill(3), top: -2, left: -2, width: 4, height: 4 },
    maxHealth: 120,
  },
  tinyHut: {
    radius: 0.25,
    tilemap: { map: Array(4).fill(3), top: -1, left: -1, width: 2, height: 2 },
    maxHealth: 20,
  },
  wideHut: {
    radius: 0.75,
    tilemap: { map: Array(36).fill(3), top: -3, left: -3, width: 6, height: 6 },
    maxHealth: 120,
  },
  rotundHut: {
    radius: 1,
    tilemap: { map: Array(64).fill(3), top: -4, left: -4, width: 8, height: 8 },
    maxHealth: 200,
  },
  fence: {
    radius: 0.25,
    tilemap: { map: Array(4).fill(3), top: -1, left: -1, width: 2, height: 2 },
    isDoodad: true,
  },
};

export const BUILD_RADIUS = 0.7;

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
