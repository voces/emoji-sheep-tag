import { Entity, Item, UnitDataAction } from "./types.ts";

export const classificationGroups = {
  alliance: ["ally", "enemy", "neutral"],
  structureOrUnit: ["structure", "unit"],
  identity: ["self", "other"],
} as const;
export type ClassificationGroup = keyof typeof classificationGroups;
export type Classification =
  typeof classificationGroups[ClassificationGroup][number];

// The minimum range to hit through corners is (0.125 ** 2 * 2) ** 0.5 * 2,
// ≈0.354 This is because the edge of an entity's circle can be at the very
// center of a its occupied grid cell. A grid cell is 0.25 x 0.25, which means
// the circle can be ((0.25/2)**2*2)**0.5 from the corner. Multiple by two to
// account for both entities.

// The minimum range to hit through corners for entities that are not hard
// pressed against the corners but still occupy them would be
// (0.25 ** 2 * 2) ** 0.5 * 2, ≈0.707. Similar logic as above, but now we may need to
// reach across both entire cells.

const move: UnitDataAction = {
  name: "Move",
  type: "target",
  order: "move",
  targeting: ["other"],
  aoe: 0,
  binding: ["KeyV"],
  smart: { ground: 0, ally: 0 },
};

const stop: UnitDataAction = {
  name: "Stop",
  type: "auto",
  order: "stop",
  binding: ["KeyZ"],
};

const back: UnitDataAction = {
  name: "Back",
  type: "auto",
  order: "back",
  binding: ["Backquote"],
};

const selfDestruct: UnitDataAction = {
  name: "Self destruct",
  type: "auto",
  order: "selfDestruct",
  binding: ["KeyX"],
};

export const items: Record<string, Item> = {
  claw: {
    id: "claw",
    name: "Claws +20",
    icon: "claw2",
    gold: 60,
    binding: ["KeyC"],
    damage: 20,
  },
  foxItem: {
    id: "foxItem",
    name: "Fox Token",
    icon: "fox",
    gold: 100,
    binding: ["KeyF"],
    charges: 1,
    actions: [{
      name: "Summon Fox",
      type: "auto",
      order: "fox",
      binding: ["KeyF"],
      castDuration: 0.1,
    }],
  },
  swiftness: {
    id: "swiftness",
    name: "Swift Claws +15%",
    icon: "claw",
    gold: 40,
    binding: ["KeyV"],
    attackSpeedMultiplier: 1.15,
  },
  boots: {
    id: "boots",
    name: "Boots +30",
    icon: "runningShoes",
    gold: 50,
    binding: ["KeyB"],
    movementSpeedBonus: 0.3,
  },
  speedPot: {
    id: "speedPot",
    name: "Speed Potion",
    icon: "purplePotion",
    gold: 30,
    binding: ["KeyS"],
    charges: 1,
    actions: [{
      name: "Use Speed Potion",
      type: "auto",
      order: "speedPot",
      binding: ["KeyS"],
      buffDuration: 10,
      attackSpeedMultiplier: 1.1,
      movementSpeedMultiplier: 1.15,
      soundOnCastStart: "jarOpen1",
    }],
  },
};

export const prefabs: Record<
  string,
  Pick<
    Entity,
    | "name"
    | "movementSpeed"
    | "turnSpeed"
    | "radius"
    | "pathing"
    | "tilemap"
    | "requiresTilemap"
    | "attack"
    | "maxHealth"
    | "mana"
    | "maxMana"
    | "manaRegen"
    | "actions"
    | "isDoodad"
    | "model"
    | "modelScale"
    | "sounds"
    | "completionTime"
    | "inventory"
  >
> = {
  sheep: {
    name: "Sheep",
    movementSpeed: 3,
    turnSpeed: 15,
    radius: 0.25,
    pathing: 1,
    actions: [
      move,
      stop,
      { name: "Build Hut", type: "build", unitType: "hut", binding: ["KeyF"] },
      {
        name: "Build Wide Hut",
        type: "build",
        unitType: "wideHut",
        binding: ["KeyW"],
        goldCost: 4,
      },
      {
        name: "Build Rotund Hut",
        type: "build",
        unitType: "rotundHut",
        binding: ["KeyR"],
        goldCost: 8,
      },
      {
        name: "Build Tiny Hut",
        type: "build",
        unitType: "tinyHut",
        binding: ["KeyT"],
      },
      {
        name: "Build Stack Hut",
        type: "build",
        unitType: "stackHut",
        binding: ["KeyS"],
        goldCost: 12,
      },
      {
        name: "Build Translocation Hut",
        type: "build",
        unitType: "translocationHut",
        binding: ["KeyE"],
        goldCost: 30,
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
    inventory: [],
    movementSpeed: 3.1,
    turnSpeed: 10,
    radius: 0.5,
    pathing: 1,
    mana: 60,
    maxMana: 100,
    manaRegen: 1,
    attack: {
      damage: 70,
      // TODO: check range for wolf attacking sheep via corner
      range: 0.09, // Sheep between two huts is 0.25; this gives a bit of wiggle
      rangeMotionBuffer: 0.93,
      cooldown: 1.2,
      backswing: 0.15,
      damagePoint: 0.3,
    },
    actions: [
      {
        name: "Attack",
        type: "target",
        order: "attack",
        targeting: ["other"],
        aoe: 0,
        binding: ["KeyA"],
        smart: { enemy: 0 },
      },
      move,
      stop,
      { name: "Hold position", type: "auto", order: "hold", binding: ["KeyH"] },
      {
        name: "Mirror Image",
        type: "auto",
        order: "mirrorImage",
        binding: ["KeyR"],
        manaCost: 20,
        castDuration: 0.5,
      },
      {
        name: "Shop",
        type: "menu",
        binding: ["KeyB"],
        actions: [
          back,
          ...Object.values(items).map((item): UnitDataAction => ({
            name: `Purchase ${item.name}`,
            type: "purchase",
            itemId: item.id,
            binding: item.binding,
            goldCost: item.gold,
          })),
        ],
      },
    ],
  },
  fox: {
    name: "Fox",
    movementSpeed: 2.5,
    turnSpeed: 8,
    radius: 0.5,
    pathing: 1,
    attack: {
      damage: 20,
      range: 0.09, // Sheep between two huts is 0.25; this gives a bit of wiggle
      rangeMotionBuffer: 0.93,
      cooldown: 0.8,
      backswing: 0.10,
      damagePoint: 0.2,
    },
    actions: [
      {
        name: "Attack",
        type: "target",
        order: "attack",
        targeting: ["other"],
        aoe: 0,
        binding: ["KeyA"],
        smart: { enemy: 0 },
      },
      move,
      stop,
      { name: "Hold position", type: "auto", order: "hold", binding: ["KeyH"] },
    ],
  },
  hut: {
    name: "Hut",
    radius: 0.5,
    tilemap: { map: Array(16).fill(3), top: -2, left: -2, width: 4, height: 4 },
    maxHealth: 120,
    completionTime: 0.7,
    sounds: { birth: ["construction1"], death: ["explosion1"] },
    actions: [selfDestruct],
  },
  tinyHut: {
    name: "Tiny Hut",
    model: "hut",
    modelScale: 0.5,
    radius: 0.25,
    tilemap: { map: Array(4).fill(3), top: -1, left: -1, width: 2, height: 2 },
    maxHealth: 20,
    completionTime: 0.5,
    sounds: { birth: ["construction1"], death: ["explosion1"] },
    actions: [selfDestruct],
  },
  wideHut: {
    name: "Wide Hut",
    model: "hut",
    modelScale: 1.5,
    radius: 0.75,
    tilemap: { map: Array(36).fill(3), top: -3, left: -3, width: 6, height: 6 },
    maxHealth: 140,
    completionTime: 1,
    sounds: { birth: ["construction1"], death: ["explosion1"] },
    actions: [selfDestruct],
  },
  rotundHut: {
    name: "Rotund Hut",
    model: "hut",
    modelScale: 2,
    radius: 1,
    tilemap: { map: Array(64).fill(3), top: -4, left: -4, width: 8, height: 8 },
    maxHealth: 200,
    completionTime: 1.5,
    sounds: { birth: ["construction1"], death: ["explosion1"] },
    actions: [selfDestruct],
  },
  stackHut: {
    name: "Stack Hut",
    model: "hinduTemple",
    radius: 0.5,
    tilemap: { map: Array(16).fill(3), top: -2, left: -2, width: 4, height: 4 },
    requiresTilemap: {
      map: Array(16).fill(4),
      top: -2,
      left: -2,
      width: 4,
      height: 4,
    },
    maxHealth: 15,
    completionTime: 3,
    sounds: { birth: ["construction1"], death: ["explosion1"] },
    actions: [selfDestruct],
  },
  translocationHut: {
    name: "Translocation Hut",
    model: "divinity",
    radius: 0.5,
    tilemap: { map: Array(16).fill(3), top: -2, left: -2, width: 4, height: 4 },
    maxHealth: 10,
    sounds: { birth: ["construction1"], death: ["explosion1"] },
    actions: [selfDestruct],
  },
  fence: {
    radius: 0.25,
    tilemap: { map: Array(4).fill(3), top: -1, left: -1, width: 2, height: 2 },
    isDoodad: true,
  },
};

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
