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
  Pick<
    Entity,
    | "name"
    | "movementSpeed"
    | "turnSpeed"
    | "radius"
    | "pathing"
    | "tilemap"
    | "attack"
    | "maxHealth"
    | "actions"
    | "isDoodad"
    | "model"
    | "modelScale"
    | "sounds"
  >
> = {
  sheep: {
    name: "Sheep",
    movementSpeed: 3,
    turnSpeed: 15,
    radius: 0.25,
    pathing: 1,
    actions: [
      {
        name: "Build Tiny Hut",
        type: "build",
        unitType: "tinyHut",
        binding: ["KeyT"],
      },
      { name: "Build Hut", type: "build", unitType: "hut", binding: ["KeyF"] },
      {
        name: "Build Wide Hut",
        type: "build",
        unitType: "wideHut",
        binding: ["KeyW"],
      },
      {
        name: "Build Rotund Hut",
        type: "build",
        unitType: "rotundHut",
        binding: ["KeyR"],
      },
      {
        name: "Destroy last farm",
        type: "auto",
        order: "destroyLastFarm",
        binding: ["KeyX"],
      },
    ],
    maxHealth: 20,
    sounds: { what: ["sheep1", "sheep2", "sheep3"], death: ["splat1"] },
  },
  wolf: {
    name: "Wolf",
    movementSpeed: 3.1,
    turnSpeed: 11,
    radius: 0.5,
    pathing: 1,
    attack: {
      damage: 70,
      range: 0.32, // roughly minimum to hit via corner
      rangeMotionBuffer: 0.92,
      cooldown: 1.2,
      backswing: 0.15,
      damagePoint: 0.3,
    },
    actions: [
      { name: "Hold position", type: "auto", order: "hold", binding: ["KeyH"] },
    ],
  },
  hut: {
    name: "Hut",
    radius: 0.5,
    tilemap: { map: Array(16).fill(3), top: -2, left: -2, width: 4, height: 4 },
    maxHealth: 120,
    sounds: { death: ["explosion1"] },
  },
  tinyHut: {
    name: "Tiny Hut",
    model: "hut",
    modelScale: 0.5,
    radius: 0.25,
    tilemap: { map: Array(4).fill(3), top: -1, left: -1, width: 2, height: 2 },
    maxHealth: 20,
    sounds: { death: ["explosion1"] },
  },
  wideHut: {
    name: "Wide Hut",
    model: "hut",
    modelScale: 1.5,
    radius: 0.75,
    tilemap: { map: Array(36).fill(3), top: -3, left: -3, width: 6, height: 6 },
    maxHealth: 140,
    sounds: { death: ["explosion1"] },
  },
  rotundHut: {
    name: "Rotund Hut",
    model: "hut",
    modelScale: 2,
    radius: 1,
    tilemap: { map: Array(64).fill(3), top: -4, left: -4, width: 8, height: 8 },
    maxHealth: 200,
    sounds: { death: ["explosion1"] },
  },
  fence: {
    radius: 0.25,
    tilemap: { map: Array(4).fill(3), top: -1, left: -1, width: 2, height: 2 },
    isDoodad: true,
  },
};

export const BUILD_RADIUS = 0.7;

export const colors: string[] = [
  "#ff0303",
  "#0042ff",
  "#1ce6b9",
  "#540081",
  "#fffc01",
  "#feba0e",
  "#20c000",
  "#e55bb0",
  "#959697",
  "#7ebff1",
  "#106246",
  "#4e2a04",
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
