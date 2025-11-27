import {
  PATHING_BLIGHT,
  PATHING_BUILDABLE,
  PATHING_NONE,
  PATHING_RESERVED,
  PATHING_SOLID,
  PATHING_SPIRIT,
  PATHING_WALKABLE,
} from "./constants.ts";
import { Buff, Entity, Item, UnitDataAction } from "./types.ts";

export const classificationGroups = {
  alliance: ["ally", "enemy", "neutral"],
  destructibles: ["structure", "unit", "tree", "ward"],
  identity: ["self", "other"],
  spirit: ["spirit", "notSpirit"],
} as const;

export type ClassificationGroup = keyof typeof classificationGroups;

export const defaultClassifications = {
  alliance: ["ally", "enemy", "neutral"],
  destructibles: ["structure", "unit"],
  identity: ["self", "other"],
  spirit: ["notSpirit"],
} satisfies {
  [K in ClassificationGroup]: typeof classificationGroups[K][number][];
};

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
  icon: "route",
  targeting: [["other"]],
  aoe: 0,
  binding: ["KeyV"],
  smart: { ground: 1, ally: 1 },
};

const stop: UnitDataAction = {
  name: "Stop",
  type: "auto",
  order: "stop",
  binding: ["KeyZ"],
};

const hold: UnitDataAction = {
  name: "Hold position",
  type: "auto",
  order: "hold",
  icon: "suspend",
  binding: ["KeyH"],
};

const selfDestruct: UnitDataAction = {
  name: "Self destruct",
  type: "auto",
  order: "selfDestruct",
  icon: "collision",
  binding: ["KeyX"],
  allowAllies: true,
  canExecuteWhileConstructing: true,
};

export const practiceModeActions = {
  giveToEnemy: {
    name: "Give to Enemy",
    description: "Transfer control to enemy player",
    type: "auto",
    order: "giveToEnemy",
    icon: "alignment",
    binding: ["KeyU"],
  } as const satisfies UnitDataAction,
  reclaimFromEnemy: {
    name: "Reclaim",
    description: "Take back control from enemy",
    type: "auto",
    order: "reclaimFromEnemy",
    icon: "alignment",
    binding: ["KeyU"],
  } as const satisfies UnitDataAction,
};

export const items: Record<string, Item> = {
  claw: {
    id: "claw",
    name: "Claws +20",
    icon: "claw2",
    gold: 180,
    binding: ["KeyC"],
    buffs: [{ damageBonus: 20 }],
  },
  echoFang: {
    id: "echoFang",
    name: "Echo Fang",
    description:
      "Adds +5 damage and creates a splash that deals +15 damage to nearby enemy structures.",
    icon: "fangs",
    gold: 250,
    binding: ["KeyA"],
    buffs: [{
      damageBonus: 5,
      splashDamage: 15,
      splashRadius: 2,
      splashTargets: [["enemy", "structure"]],
    }],
  },
  direCollar: {
    id: "direCollar",
    name: "Dire Collar",
    description: "Deals 15 damage per second to nearby enemy structures.",
    icon: "direCollar",
    gold: 200,
    binding: ["KeyD"],
    buffs: [{
      radius: 1.75,
      tickDamage: 15,
      tickInterval: 1,
      targetsAllowed: [["enemy", "structure"]],
      model: "crimsonArc",
      particleRate: 50,
      particleOffsetRange: 1.5,
      particleMinOffsetRange: 0.5,
      particleScaleRange: 0.5,
      particleLifetime: 0.5,
    }],
  },
  foxToken: {
    id: "foxToken",
    name: "Fox Token",
    icon: "fox",
    gold: 140,
    binding: ["KeyF"],
    charges: 1,
    actions: [{
      name: "Summon Fox",
      type: "auto",
      order: "fox",
      binding: ["KeyF"],
      castDuration: 0.1,
      buffDuration: 150,
    }],
  },
  strengthPotion: {
    id: "strengthPotion",
    name: "Potion of Strength",
    description: "Next attack deals 2000% damage (20x)",
    icon: "pinkPotion",
    gold: 35,
    binding: ["KeyG"],
    charges: 1,
    actions: [{
      name: "Drink Potion of Strength",
      type: "auto",
      order: "strengthPotion",
      icon: "pinkPotion",
      binding: ["KeyG"],
      castDuration: 0.2,
      buffDuration: 300,
      damageMultiplier: 20,
      soundOnCastStart: "jarOpen1",
    }],
  },
  swiftness: {
    id: "swiftness",
    name: "Swift Claws +15%",
    description: "Increases attack speed by 15%.",
    icon: "claw",
    gold: 110,
    binding: ["KeyW"],
    buffs: [{ attackSpeedMultiplier: 1.15 }],
  },
  boots: {
    id: "boots",
    name: "Boots +30",
    description: "Increases movement speed by 30.",
    icon: "runningShoes",
    gold: 110,
    binding: ["KeyB"],
    buffs: [{ movementSpeedBonus: 0.3 }],
  },
  speedPot: {
    id: "speedPot",
    name: "Potion of Speed",
    description:
      "Increases attack speed by 10% and movement speed by 15% for 10 seconds.",
    icon: "purplePotion",
    gold: 40,
    binding: ["KeyS"],
    charges: 1,
    actions: [{
      name: "Drink Potion of Speed",
      description:
        "Increases attack speed by 10% and movement speed by 15% for 10 seconds.",
      type: "auto",
      order: "speedPot",
      icon: "purplePotion",
      binding: ["KeyS"],
      buffDuration: 10,
      attackSpeedMultiplier: 1.1,
      movementSpeedMultiplier: 1.15,
      soundOnCastStart: "jarOpen1",
    }],
  },
  bomber: {
    id: "bomber",
    name: "Bomber",
    description: "Bombs an area, damaging structures and trees but not units.",
    icon: "meteor",
    gold: 75,
    binding: ["KeyE"],
    charges: 1,
    actions: [{
      name: "Summon Meteor",
      description:
        "Bombs an area, damaging structures and trees but not units.",
      type: "target",
      order: "meteor",
      aoe: 1.5,
      targeting: [["structure", "tree"]],
      binding: ["KeyE"],
      range: 5,
      damage: 50,
    }],
  },
  manaPotion: {
    id: "manaPotion",
    name: "Mana Potion",
    description: "Restores 100 mana.",
    icon: "bluePotion",
    gold: 30,
    binding: ["KeyM"],
    charges: 1,
    actions: [{
      name: "Drink Mana Potion",
      type: "auto",
      order: "manaPotion",
      icon: "bluePotion",
      binding: ["KeyM"],
      manaRestore: 100,
      soundOnCastStart: "jarOpen1",
    }],
  },
  locateSheep: {
    id: "locateSheep",
    name: "Locate Sheep",
    description: "Reveals the location of all sheep.",
    icon: "location",
    gold: 40,
    binding: ["KeyT"],
    charges: 1,
    actions: [{
      name: "Locate Sheep",
      type: "auto",
      order: "locateSheep",
      icon: "location",
      binding: ["KeyT"],
    }],
  },
  scythe: {
    id: "scythe",
    name: "Scythe",
    description: "Increases gold bounty from kills.",
    icon: "scythe",
    gold: 110,
    binding: ["KeyY"],
    buffs: [{
      bountyMultiplier: 2,
      bountyBonus: 1,
    }],
  },
  hayTrap: {
    id: "hayTrap",
    name: "Hay Trap",
    description: "Launch a hay cube that becomes a structure when it lands.",
    icon: "hayCube",
    gold: 50,
    binding: ["KeyX"],
    charges: 1,
    actions: [{
      name: "Launch Hay Trap",
      type: "target",
      order: "hayTrap",
      icon: "hayCube",
      targeting: [["other"]],
      aoe: 0,
      binding: ["KeyX"],
      castDuration: 0.25,
      range: 5,
    }],
  },
  beam: {
    id: "beam",
    name: "Beam",
    description: "Casts a beam that destroys structures in its path.",
    icon: "beamStart",
    gold: 100,
    binding: ["KeyQ"],
    charges: 1,
    actions: [{
      name: "Cast Beam",
      type: "target",
      order: "beam",
      icon: "beamStart",
      targeting: [["structure"]],
      aoe: 0,
      binding: ["KeyQ"],
      castDuration: 0.4,
    }],
  },
};

export const buffs: Record<string, Buff> = {
  frostEffect: {
    remainingDuration: 5,
    movementSpeedMultiplier: 0.85,
    attackSpeedMultiplier: 0.95,
  },
  totemMovementAura: {
    movementSpeedMultiplier: 1.04,
    model: "wind",
    modelOffset: { y: 0.35 },
    modelScale: 0.6,
  },
  totemHealthRegenAura: {
    healthRegen: 2,
  },
  totemDamageMitigationAura: {
    damageMitigation: 0.3,
    model: "shield",
    modelOffset: { x: 0.1, y: 0.2 },
  },
};

type DataEntity =
  & Pick<
    Entity,
    | "name"
    | "type"
    //
    | "model"
    | "modelScale"
    | "vertexColor"
    | "alpha"
    | "sounds"
    //
    | "facing"
    //
    | "maxHealth"
    | "healthRegen"
    | "mana"
    | "maxMana"
    | "manaRegen"
    //
    | "movementSpeed"
    | "turnSpeed"
    | "sightRadius"
    | "gait"
    | "blocksLineOfSight"
    | "actions"
    | "buffs"
    | "completionTime"
    | "isDoodad"
    //
    | "attack"
    | "targetedAs"
    //
    | "radius"
    | "pathing"
    | "requiresPathing"
    | "blocksPathing"
    | "tilemap"
    | "requiresTilemap"
    //
    | "inventory"
    //
    | "bounty"
  >
  & {
    unique?: boolean;
  };

const b = PATHING_WALKABLE | PATHING_BUILDABLE | PATHING_SOLID;

const tilemap2x2 = {
  map: Array(4).fill(b),
  top: -1,
  left: -1,
  width: 2,
  height: 2,
};

const tilemap2x2None = {
  map: Array(4).fill(PATHING_NONE),
  top: -1,
  left: -1,
  width: 2,
  height: 2,
};

const tilemap2x2Spirit = {
  map: Array(4).fill(b | PATHING_SPIRIT),
  top: -1,
  left: -1,
  width: 2,
  height: 2,
};

const tilemap2x4 = {
  map: Array(8).fill(b),
  top: -1,
  left: -2,
  width: 4,
  height: 2,
};

const tilemap4x4 = {
  map: Array(16).fill(b),
  top: -2,
  left: -2,
  width: 4,
  height: 4,
};

const tilemap4x4Blight = {
  map: Array(16).fill(PATHING_BLIGHT),
  top: -2,
  left: -2,
  width: 4,
  height: 4,
};

const tilemap6x6 = {
  map: Array(36).fill(b),
  top: -3,
  left: -3,
  width: 6,
  height: 6,
};

const tilemap8x8 = {
  map: Array(64).fill(b),
  top: -4,
  left: -4,
  width: 8,
  height: 8,
};

const tilemapHayBale = {
  map: [
    [0, 0, b, b, b, b, 0, 0, 0, 0],
    [0, 0, b, b, b, b, 0, 0, 0, 0],
    [b, b, b, b, b, b, b, b, 0, 0],
    [b, b, b, b, b, b, b, b, 0, 0],
    [b, b, b, b, b, b, b, b, b, b],
    [b, b, b, b, b, b, b, b, b, b],
    [0, 0, b, b, b, b, b, b, b, b],
    [0, 0, b, b, b, b, b, b, b, b],
    [0, 0, 0, 0, b, b, b, b, 0, 0],
    [0, 0, 0, 0, b, b, b, b, 0, 0],
  ]
    .flat(),
  top: -5,
  left: -5,
  width: 10,
  height: 10,
};

const tilemapWindmill = {
  map: [
    [b, b, b, b, b, b, b, b],
    [b, b, b, b, b, b, b, b],
    [b, b, b, b, b, b, b, b],
    [b, b, b, b, b, b, b, b],
    [b, b, b, b, 0, 0, 0, 0],
    [b, b, b, b, 0, 0, 0, 0],
  ].flat(),
  top: -3,
  left: -4,
  width: 8,
  height: 6,
};

export const prefabs: Record<string, DataEntity> = {
  sheep: {
    name: "Sheep",
    movementSpeed: 3,
    turnSpeed: 15,
    sightRadius: 6,
    radius: 0.25,
    pathing: PATHING_WALKABLE,
    gait: {
      duration: 0.2,
      components: [{ radiusX: 0.003, radiusY: 0.015, frequency: 1, phase: 0 }],
    },
    actions: [
      move,
      stop,
      { name: "Build Hut", type: "build", unitType: "hut", binding: ["KeyF"] },
      {
        name: "Build Cabin",
        description: "Can take more damage than a hut.",
        type: "build",
        unitType: "cabin",
        binding: ["KeyG"],
        goldCost: 4,
      },
      {
        name: "Build Totem",
        description:
          "Provides auras to nearby allies: +4% movement speed, +2 HP/s regen, and 30% damage mitigation for structures.",
        type: "build",
        unitType: "totem",
        binding: ["KeyA"],
        goldCost: 40,
      },
      {
        name: "Build Cottage",
        description: "A larger variant of the hut.",
        type: "build",
        unitType: "cottage",
        binding: ["KeyW"],
        goldCost: 4,
      },
      {
        name: "Build House",
        description: "A much larger variant of a cabin.",
        type: "build",
        unitType: "house",
        binding: ["KeyR"],
        goldCost: 8,
      },
      {
        name: "Build Shack",
        type: "build",
        unitType: "shack",
        binding: ["KeyT"],
      },
      {
        name: "Build Temple",
        description: "Can be built anywhere except in the middle.",
        type: "build",
        unitType: "temple",
        binding: ["KeyS"],
        goldCost: 12,
      },
      {
        name: "Build Translocation Hut",
        description: "Translocates the sheep upon construction.",
        type: "build",
        unitType: "translocationHut",
        binding: ["KeyE"],
        goldCost: 70,
      },
      {
        name: "Build Watchtower",
        description: "Provides vision over a large area.",
        type: "build",
        unitType: "watchtower",
        binding: ["KeyC"],
        goldCost: 12,
      },
      {
        name: "Destroy last farm",
        type: "auto",
        order: "destroyLastFarm",
        icon: "collision",
        binding: ["KeyX"],
      },
      {
        name: "Bite",
        description: "Destroy enemy wards and save dead allies.",
        type: "target",
        icon: "bite",
        targeting: [["spirit"], ["ward"], ["structure"]],
        order: "save",
        range: 0,
        castDuration: 0.5,
        smart: { spirit: 0, ward: 0, enemy: 0 },
        binding: ["KeyB"],
      },
    ],
    maxHealth: 20,
    sounds: { what: ["sheep1", "sheep2", "sheep3"], death: ["splat1"] },
  },
  wolf: {
    name: "Wolf",
    unique: true,
    inventory: [],
    movementSpeed: 3.1,
    turnSpeed: 10,
    sightRadius: 14,
    radius: 0.5,
    pathing: PATHING_WALKABLE,
    gait: {
      duration: 0.55,
      components: [{ radiusX: 0.005, radiusY: 0.015, frequency: 1, phase: 0 }],
    },
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
      model: "claw",
    },
    actions: [
      {
        name: "Attack",
        type: "target",
        order: "attack",
        icon: "sword",
        targeting: [["other"]],
        aoe: 0,
        binding: ["KeyA"],
        smart: { enemy: 0 },
      },
      move,
      stop,
      hold,
      {
        name: "Shadowstep",
        description:
          "Creates a short lived illusion of your wolf to dodge incoming attacks and confuse sheep.",
        type: "auto",
        order: "dodge",
        icon: "wolfDodge",
        binding: ["KeyD"],
        manaCost: 5,
        buffDuration: 0.4,
      },
      {
        name: "Mirror Image",
        description:
          "Creates a weak copy of your wolf which is capable of blocking the sheep and dealing minor damage to structures. Dispels all buffs.",
        type: "auto",
        order: "mirrorImage",
        icon: "wolf",
        iconEffect: "mirror",
        binding: ["KeyR"],
        manaCost: 20,
        castDuration: 0.5,
        buffDuration: 60,
      },
      {
        name: "Swap",
        description: "Swap positions with your mirror image.",
        type: "auto",
        order: "swap",
        icon: "swap",
        binding: ["KeyC"],
        manaCost: 40,
        castDuration: 1.5,
      },
      {
        name: "Place Sentry",
        description: "Places a Sentry Ward which can watch for sheep.",
        type: "target",
        order: "sentry",
        icon: "sentry",
        targeting: [["other"]],
        aoe: 0,
        binding: ["KeyW"],
        manaCost: 10,
        range: 5,
        castDuration: 0.3,
      },
      ...Object.values(items).map((item): UnitDataAction => ({
        name: `Purchase ${item.name}`,
        description: item.description,
        type: "purchase",
        itemId: item.id,
        binding: item.binding,
        goldCost: item.gold,
      })),
    ],
    sounds: { what: ["growl1", "growl2", "growl4"], ackAttack: ["growl3"] },
  },
  spirit: {
    name: "Spirit",
    model: "sheep",
    modelScale: 0.5,
    alpha: 0.7,
    movementSpeed: 1,
    turnSpeed: 5,
    sightRadius: 3,
    radius: 0.125,
    pathing: PATHING_SPIRIT,
    blocksPathing: PATHING_NONE,
    actions: [move, stop],
    targetedAs: ["spirit"],
    sounds: { what: ["spirit1", "spirit2", "spirit3"] },
  },
  fox: {
    name: "Fox",
    movementSpeed: 2.5,
    turnSpeed: 8,
    sightRadius: 10,
    radius: 0.5,
    pathing: PATHING_WALKABLE,
    gait: {
      duration: 0.65,
      components: [{ radiusX: 0.006, radiusY: 0.016, frequency: 1, phase: 0 }],
    },
    attack: {
      damage: 20,
      range: 0.09, // Sheep between two huts is 0.25; this gives a bit of wiggle
      rangeMotionBuffer: 0.93,
      cooldown: 0.8,
      backswing: 0.10,
      damagePoint: 0.2,
      model: "claw",
    },
    actions: [
      {
        name: "Attack",
        type: "target",
        order: "attack",
        icon: "sword",
        targeting: [["other"]],
        aoe: 0,
        binding: ["KeyA"],
        smart: { enemy: 0 },
      },
      move,
      stop,
      hold,
    ],
  },
  hut: {
    name: "Hut",
    sightRadius: 4,
    radius: 0.5,
    tilemap: tilemap4x4,
    maxHealth: 120,
    completionTime: 0.7,
    sounds: { birth: ["construction1"], death: ["explosion1"] },
    actions: [{
      name: "Illusify",
      description:
        "Makes the hut an illusion, allowing units to pass through it.",
      type: "auto",
      order: "illusify",
      icon: "hut",
      iconEffect: "mirror",
      goldCost: 12,
      binding: ["KeyS"],
    }, {
      name: "Upgrade to Frost Castle",
      description:
        "Upgrades the hut to a Frost Castle, which is capable of firing frost orbs at wolves.",
      type: "upgrade",
      prefab: "frostCastle",
      goldCost: 30,
      binding: ["KeyF"],
    }, {
      name: "Upgrade to Crystal",
      description:
        "Upgrades the hut to a Crystal, which is capable of casting buffs on nearby units.",
      type: "upgrade",
      prefab: "crystal",
      goldCost: 20,
      binding: ["KeyC"],
    }, selfDestruct],
    bounty: 1,
  },
  cabin: {
    name: "Cabin",
    sightRadius: 4,
    radius: 0.5,
    tilemap: tilemap4x4,
    maxHealth: 220, // Tuned to be 3 hit with 1 claw and 2 hit with 2 claws
    completionTime: 1.1,
    sounds: { birth: ["construction1"], death: ["explosion1"] },
    actions: [selfDestruct],
    bounty: 2,
  },
  shack: {
    name: "Shack",
    sightRadius: 4,
    radius: 0.25,
    tilemap: tilemap2x2,
    maxHealth: 20,
    completionTime: 0.65,
    sounds: { birth: ["construction1"], death: ["explosion1"] },
    actions: [selfDestruct],
    bounty: 1,
  },
  totem: {
    name: "Totem",
    sightRadius: 4,
    radius: 0.5,
    tilemap: tilemap4x4,
    maxHealth: 200,
    completionTime: 10,
    sounds: { birth: ["construction1"], death: ["explosion1"] },
    actions: [selfDestruct],
    bounty: 4,
    buffs: [{
      radius: 7,
      auraBuff: "totemMovementAura",
      targetsAllowed: [["unit", "ally"]],
    }, {
      radius: 7,
      auraBuff: "totemHealthRegenAura",
      targetsAllowed: [["ally"]],
    }, {
      radius: 7,
      auraBuff: "totemDamageMitigationAura",
      targetsAllowed: [["structure", "ally"]],
    }],
  },
  cottage: {
    name: "Cottage",
    sightRadius: 4,
    radius: 0.75,
    tilemap: tilemap6x6,
    maxHealth: 140,
    completionTime: 1,
    sounds: { birth: ["construction1"], death: ["explosion1"] },
    actions: [selfDestruct],
    bounty: 3,
  },
  house: {
    name: "House",
    model: "house",
    sightRadius: 4,
    radius: 1,
    tilemap: tilemap8x8,
    maxHealth: 200,
    completionTime: 1.5,
    sounds: { birth: ["construction1"], death: ["explosion1"] },
    actions: [selfDestruct],
    bounty: 4,
  },
  temple: {
    name: "Temple",
    model: "hinduTemple",
    sightRadius: 4,
    radius: 0.5,
    tilemap: tilemap4x4,
    requiresTilemap: tilemap4x4Blight,
    maxHealth: 15,
    completionTime: 3,
    sounds: { birth: ["construction1"], death: ["explosion1"] },
    actions: [selfDestruct],
    bounty: 4,
  },
  translocationHut: {
    name: "Translocation Hut",
    model: "divinity",
    sightRadius: 4,
    radius: 0.5,
    tilemap: tilemap4x4,
    maxHealth: 10,
    sounds: { birth: ["construction1"], death: ["explosion1"] },
    actions: [selfDestruct],
    bounty: 5,
  },
  watchtower: {
    name: "Watchtower",
    sightRadius: 15,
    radius: 0.5,
    tilemap: tilemap4x4,
    maxHealth: 200,
    completionTime: 3,
    sounds: { birth: ["construction1"], death: ["explosion1"] },
    actions: [selfDestruct],
    bounty: 3,
  },
  frostCastle: {
    name: "Frost Castle",
    model: "castle",
    sightRadius: 6,
    radius: 0.5,
    tilemap: tilemap4x4,
    maxHealth: 200,
    completionTime: 5,
    sounds: {
      birth: ["construction1"],
      death: ["explosion1"],
      projectileHit: ["frostburst1"],
    },
    actions: [
      {
        name: "Attack",
        type: "target",
        order: "attack",
        icon: "sword",
        targeting: [["unit", "ward"]],
        aoe: 0,
        binding: ["KeyA"],
        smart: { enemy: 0 },
      },
      {
        name: "Attack ground",
        type: "target",
        order: "attack-ground",
        icon: "attackGround",
        targeting: [["other"]],
        aoe: 1,
        binding: ["KeyG"],
        smart: { ground: 0 },
      },
      stop,
      selfDestruct,
    ],
    bounty: 4,
    attack: {
      damage: 5,
      range: 5,
      rangeMotionBuffer: 1,
      cooldown: 2.75,
      backswing: 0.1,
      damagePoint: 0.2,
      projectileSpeed: 8,
      model: "frostOrb",
      targetsAllowed: [["unit", "ward"]],
    },
    buffs: [{ impartedBuffOnAttack: "frostEffect" }],
  },
  crystal: {
    name: "Crystal",
    sightRadius: 6,
    radius: 0.5,
    tilemap: tilemap4x4,
    maxHealth: 200,
    mana: 50,
    maxMana: 100,
    manaRegen: 2,
    completionTime: 10,
    sounds: { birth: ["construction1"], death: ["explosion1"] },
    actions: [
      {
        name: "Gemstride",
        description: "Increase target's movement speed by 25% for 20 seconds.",
        type: "target",
        order: "crystalSpeed",
        icon: "sparkle2",
        binding: ["KeyS"],
        manaCost: 60,
        castDuration: 0.5,
        range: 5,
        targeting: [["ally", "unit"]],
        allowAllies: true,
      },
      selfDestruct,
    ],
    bounty: 6,
  },
  fence: {
    name: "Fence",
    radius: 0.25,
    tilemap: tilemap2x2Spirit,
    requiresTilemap: tilemap2x2None,
    isDoodad: true,
    type: "static",
  },
  meteor: {
    name: "Meteor",
    maxHealth: 1,
    healthRegen: -4,
    radius: 0,
    pathing: PATHING_NONE,
    movementSpeed: 5,
    sounds: { birth: ["explosion1"] },
  },
  sentry: {
    name: "Sentry Ward",
    sightRadius: 12,
    radius: 0.25,
    pathing: PATHING_RESERVED,
    requiresPathing: PATHING_NONE,
    blocksPathing: PATHING_NONE,
    maxHealth: 5,
    targetedAs: ["ward"],
    bounty: 4,
    sounds: { birth: ["splat1"], death: ["splat1"] },
  },
  tree: {
    name: "Tree",
    radius: 0.5,
    tilemap: tilemap4x4,
    isDoodad: true,
    maxHealth: 25,
    targetedAs: ["tree"],
    sounds: { death: ["treefall1"] },
    blocksLineOfSight: 1,
  },
  treeStump: {
    name: "Tree Stump",
    isDoodad: true,
  },
  rock: {
    name: "Rock",
    radius: 0.5,
    tilemap: tilemap4x4,
    isDoodad: true,
    type: "static",
  },
  well: {
    name: "Well",
    radius: 0.5,
    tilemap: tilemap4x4,
    isDoodad: true,
    type: "static",
  },
  scarecrow: {
    name: "Scarecrow",
    radius: 0.5,
    tilemap: tilemap4x4,
    isDoodad: true,
    type: "static",
  },
  barrel: {
    name: "Barrel",
    radius: 0.5,
    tilemap: tilemap4x4,
    isDoodad: true,
    type: "static",
  },
  windmill: {
    name: "Windmill",
    radius: 0.875,
    tilemap: tilemapWindmill,
    isDoodad: true,
    type: "static",
  },
  derelictHouse: {
    name: "Derelict House",
    radius: 0.75,
    tilemap: tilemap6x6,
    isDoodad: true,
    type: "static",
  },
  hayBale: {
    name: "Hay Bale",
    radius: 1,
    tilemap: tilemapHayBale,
    isDoodad: true,
    type: "static",
  },
  hayPile: {
    name: "Hay Pile",
    radius: 0.5,
    pathing: PATHING_NONE,
    isDoodad: true,
    type: "cosmetic",
  },
  hayCube: {
    name: "Hay Cube",
    radius: 0.25,
    pathing: PATHING_NONE,
    movementSpeed: 10,
    isDoodad: true,
  },
  brokenHayCube: {
    name: "Broken Hay Cube",
    radius: 0.125,
    pathing: b,
    maxHealth: 20,
    sounds: { birth: ["construction1"], death: ["explosion1"] },
    bounty: 5,
    targetedAs: ["structure"],
  },
  wood: {
    name: "Wood",
    radius: 0.375,
    tilemap: tilemap2x4,
    isDoodad: true,
    type: "static",
  },
  grass: {
    name: "Grass",
    radius: 0.125,
    pathing: PATHING_NONE,
    isDoodad: true,
    type: "cosmetic",
  },
  flowers: {
    name: "Flowers",
    radius: 0.125,
    pathing: PATHING_NONE,
    isDoodad: true,
    type: "cosmetic",
  },
  bird: {
    name: "Bird",
    model: "bird1",
    movementSpeed: 2,
    isDoodad: true,
    type: "cosmetic",
    gait: {
      duration: 0.25,
      components: [
        { radiusX: 0.002, radiusY: 0.03, frequency: 1, phase: 0 },
      ],
    },
  },
  bee: {
    name: "Bee",
    model: "bee",
    modelScale: 0.3,
    movementSpeed: 1.5,
    isDoodad: true,
    type: "cosmetic",
    gait: {
      duration: 3,
      components: [
        { radiusX: 0.08, radiusY: 0.12, frequency: 1, phase: 0 },
        { radiusX: 0.001, radiusY: 0.004, frequency: 50, phase: 0 },
      ],
    },
  },
  tile: {
    name: "Tile",
    model: "square",
    radius: 1,
    tilemap: tilemap8x8,
    isDoodad: true,
  },
};

export const tileDefs = [
  { name: "Grass", pathing: PATHING_SPIRIT, color: 0x6caa00 },
  { name: "Pen", pathing: PATHING_BUILDABLE | PATHING_BLIGHT, color: 0x4b3061 },
  {
    name: "Water",
    pathing: PATHING_BUILDABLE | PATHING_SPIRIT,
    color: 0x385670,
  },
];

export const colors: string[] = [
  "#ff0303", // red
  "#0042ff", // blue
  "#1ce6b9", // cyan
  "#540081", // purple
  "#fffc01", // yellow
  "#feba0e", // orange
  "#20c000", // green
  "#e55bb0", // pink
  "#959697", // gray
  "#7ebff1", // light blue
  "#106246", // teal
  "#4e2a04", // brown
  "#9e3432", // dark red
  "#001c49", // navy
  "#1ad3de", // turquoise
  "#bd00ff", // magenta
  "#acbd99", // sage
  "#c67c77", // salmon
  "#b1f98b", // lime
  "#8083be", // periwinkle
  "#5b4c53", // charcoal
  "#ecf0ff", // white
  "#168717", // forest green
  "#8d8f17", // olive
];
