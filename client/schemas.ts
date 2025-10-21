import z from "zod";
import { zTeam } from "@/shared/zod.ts";
import { Entity } from "@/shared/types.ts";

const zPoint = z.object({ x: z.number(), y: z.number() }).readonly();

const zStart = z.object({
  type: z.literal("start"),
  sheep: z.object({ id: z.string(), sheepCount: z.number() }).array()
    .readonly(),
  wolves: z.string().array().readonly(),
});

const zOrder = z.union([
  z.object({
    type: z.literal("walk"),
    target: zPoint,
    path: zPoint.array().readonly().optional(),
  }),
  z.object({
    type: z.literal("walk"),
    targetId: z.string(),
    path: zPoint.array().readonly().optional(),
  }),
  z.object({
    type: z.literal("build"),
    unitType: z.string(),
    x: z.number(),
    y: z.number(),
    path: zPoint.array().readonly().optional(),
  }),
  z.object({
    type: z.literal("upgrade"),
    prefab: z.string(),
  }),
  z.object({
    type: z.literal("attack"),
    targetId: z.string(),
    path: zPoint.array().readonly().optional(),
    lastRepath: z.number().optional(),
  }),
  z.object({
    type: z.literal("attack"),
    target: zPoint,
  }),
  z.object({ type: z.literal("hold") }),
  z.object({
    type: z.literal("cast"),
    orderId: z.string(),
    remaining: z.number(),
    target: zPoint.optional(),
    targetId: z.string().optional(),
    path: zPoint.array().readonly().optional(),
    started: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("attackMove"),
    target: zPoint,
    targetId: z.string().optional(),
    path: zPoint.array().readonly().optional(),
  }),
]).readonly();

const zTilemap = z.object({
  top: z.number(),
  left: z.number(),
  height: z.number(),
  width: z.number(),
  map: z.number().array().readonly(),
});

const zClassification = z.union([
  z.literal("unit"),
  z.literal("structure"),
  z.literal("tree"),
  z.literal("ward"),
  z.literal("ally"),
  z.literal("enemy"),
  z.literal("neutral"),
  z.literal("self"),
  z.literal("other"),
  z.literal("spirit"),
  z.literal("notSpirit"),
]);

const zIconEffect = z.union([z.literal("mirror")]);

// Define the base action types first (non-recursive)
const zBaseAction = z.discriminatedUnion("type", [
  z.object({
    name: z.string(),
    type: z.literal("build"),
    description: z.string().optional(),
    icon: z.string().optional(),
    unitType: z.string(),
    binding: z.array(z.string()).readonly().optional(),
    manaCost: z.number().optional(),
    goldCost: z.number().optional(),
    castDuration: z.number().optional(),
    allowAllies: z.boolean().optional(),
  }),
  z.object({
    name: z.string(),
    type: z.literal("upgrade"),
    description: z.string().optional(),
    icon: z.string().optional(),
    prefab: z.string(),
    binding: z.array(z.string()).readonly().optional(),
    goldCost: z.number().optional(),
    castDuration: z.number().optional(),
    allowAllies: z.boolean().optional(),
  }),
  z.object({
    name: z.string(),
    type: z.literal("auto"),
    description: z.string().optional(),
    icon: z.string().optional(),
    iconEffect: zIconEffect.optional(),
    order: z.string(),
    binding: z.array(z.string()).readonly().optional(),
    manaCost: z.number().optional(),
    goldCost: z.number().optional(),
    castDuration: z.number().optional(),
    buffDuration: z.number().optional(),
    attackSpeedMultiplier: z.number().optional(),
    movementSpeedBonus: z.number().optional(),
    movementSpeedMultiplier: z.number().optional(),
    damageMultiplier: z.number().optional(),
    manaRestore: z.number().optional(),
    soundOnCastStart: z.string().optional(),
    allowAllies: z.boolean().optional(),
    canExecuteWhileConstructing: z.boolean().optional(),
  }),
  z.object({
    name: z.string(),
    type: z.literal("purchase"),
    description: z.string().optional(),
    icon: z.string().optional(),
    itemId: z.string(),
    goldCost: z.number(),
    binding: z.array(z.string()).readonly().optional(),
    manaCost: z.number().optional(),
    castDuration: z.number().optional(),
    allowAllies: z.boolean().optional(),
  }),
  z.object({
    name: z.string(),
    type: z.literal("target"),
    description: z.string().optional(),
    icon: z.string().optional(),
    iconEffect: zIconEffect.optional(),
    order: z.string(),
    targeting: z.array(z.array(zClassification).readonly()).readonly()
      .optional(),
    aoe: z.number().optional(),
    binding: z.array(z.string()).readonly().optional(),
    smart: z.partialRecord(
      z.union([zClassification, z.literal("ground")]),
      z.number(),
    ).optional(),
    manaCost: z.number().optional(),
    goldCost: z.number().optional(),
    castDuration: z.number().optional(),
    range: z.number().optional(),
    damage: z.number().optional(),
    allowAllies: z.boolean().optional(),
  }),
]);

// Define the recursive action type using z.lazy with proper typing
type ActionType = z.infer<typeof zBaseAction> | {
  name: string;
  type: "menu";
  binding?: ReadonlyArray<string>;
  actions: ReadonlyArray<ActionType>;
};

const zAction: z.ZodType<ActionType, ActionType> = z.lazy(() =>
  z.union([
    zBaseAction,
    z.object({
      name: z.string(),
      type: z.literal("menu"),
      icon: z.string().optional(),
      actions: z.array(zAction).readonly(),
      description: z.string().optional(),
      binding: z.array(z.string()).readonly().optional(),
      allowAllies: z.boolean().optional(),
      goldCost: z.number().optional(),
    }),
  ])
);

const zBuff = z.object({
  remainingDuration: z.number().optional(),
  attackSpeedMultiplier: z.number().optional(),
  movementSpeedBonus: z.number().optional(),
  movementSpeedMultiplier: z.number().optional(),
  damageBonus: z.number().optional(),
  damageMultiplier: z.number().optional(),
  healthRegen: z.number().optional(),
  damageMitigation: z.number().optional(),
  bountyMultiplier: z.number().optional(),
  bountyBonus: z.number().optional(),
  consumeOnAttack: z.boolean().optional(),
  impartedBuffOnAttack: z.string().optional(),
  splashDamage: z.number().optional(),
  splashRadius: z.number().optional(),
  splashTargets: zClassification.array().readonly().array().readonly()
    .optional(),
  expiration: z.string().optional(),
  totalDuration: z.number().optional(),
  progressEasing: z.object({
    type: z.enum(["ease-in", "ease-out", "ease-in-out"]),
    duration: z.number(),
  }).optional(),
  radius: z.number().optional(),
  auraBuff: z.string().optional(),
  targetsAllowed: zClassification.array().readonly().array().readonly()
    .optional(),
  tickDamage: z.number().optional(),
  tickInterval: z.number().optional(),
  icon: z.string().optional(),
  model: z.string().optional(),
  modelOffset: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
  }).optional(),
  modelScale: z.number().optional(),
  particleRate: z.number().optional(),
  particleOffsetRange: z.number().optional(),
  particleMinOffsetRange: z.number().optional(),
  particleScaleRange: z.number().optional(),
  particleLifetime: z.number().optional(),
});

const zItem = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().optional(),
  gold: z.number(),
  binding: z.string().array().readonly(),
  charges: z.number().optional(),
  actions: z.array(zAction).readonly().optional(),
  buffs: z.array(zBuff).readonly().optional(),
});

export const zUpdate = z.object({
  id: z.string(),
  __delete: z.boolean().optional(),

  // Data
  prefab: z.string().optional(),
  name: z.string().optional(),
  owner: z.string().optional(),
  type: z.union([
    z.literal("cosmetic"),
    z.literal("static"),
    z.literal("dynamic"),
  ]).optional(),
  health: z.number().nullable().optional(),
  maxHealth: z.number().optional(),
  healthRegen: z.number().optional(),
  mana: z.number().optional(),
  maxMana: z.number().optional(),
  manaRegen: z.number().optional(),

  // Player data
  isPlayer: z.boolean().optional(),
  team: z.union([z.literal("sheep"), z.literal("wolf")]).optional(),
  gold: z.number().optional(),
  handicap: z.number().optional(),

  position: zPoint.optional(),
  movementSpeed: z.number().optional(),
  facing: z.number().nullable().optional(),
  turnSpeed: z.number().optional(),
  sightRadius: z.number().optional(),
  actions: z.array(zAction).readonly().optional(),
  completionTime: z.number().optional(),
  progress: z.number().nullable().optional(),
  isDoodad: z.boolean().nullable().optional(),
  isTimer: z.boolean().optional(),
  isFloatingText: z.boolean().optional(),
  teamScoped: z.boolean().optional(),
  unique: z.boolean().optional(),

  attack: z.object({
    damage: z.number(),
    range: z.number(),
    rangeMotionBuffer: z.number(),
    cooldown: z.number(),
    damagePoint: z.number(),
    backswing: z.number(),
    projectileSpeed: z.number().optional(),
    model: z.string().optional(),
    targetsAllowed: z.array(z.array(zClassification).readonly()).readonly()
      .optional(),
  }).nullable().optional(),
  swing: z.object({
    remaining: z.number(),
    source: z.object({ x: z.number(), y: z.number() }),
    target: z.object({ x: z.number(), y: z.number() }),
  }).nullable().optional(),
  projectile: z.object({
    attackerId: z.string(),
    target: z.object({ x: z.number(), y: z.number() }),
    speed: z.number(),
    splashRadius: z.number(),
  }).nullable().optional(),
  attackCooldownRemaining: z.number().nullable().optional(),
  lastAttacker: z.string().nullable().optional(),
  targetedAs: z.array(zClassification).readonly().optional(),

  isMirror: z.boolean().optional(),
  mirrors: z.array(z.string()).readonly().nullable().optional(),

  // Items
  inventory: zItem.array().readonly().optional(),

  // Buffs
  buffs: zBuff.array().readonly().nullable().optional(),

  // Bounty
  bounty: z.number().optional(),

  // Fog of war
  blocksLineOfSight: z.number().optional(),

  // Pathing
  radius: z.number().optional(),
  pathing: z.number().optional(),
  requiresPathing: z.number().optional(),
  blocksPathing: z.number().optional(),
  tilemap: zTilemap.optional(),
  requiresTilemap: zTilemap.optional(),
  structure: z.boolean().optional(),

  // Orders
  order: zOrder.nullable().optional(),
  queue: zOrder.array().readonly().nullable().optional(),

  // Art
  model: z.string().nullable().optional(),
  modelScale: z.number().nullable().optional(),
  vertexColor: z.number().nullable().optional(),
  playerColor: z.string().nullable().optional(),
  alpha: z.number().optional(),
  icon: z.string().optional(),
  iconEffect: zIconEffect.optional(),
  sounds: z.partialRecord(
    z.union([
      z.literal("birth"),
      z.literal("death"),
      z.literal("what"),
      z.literal("ackAttack"),
    ]),
    z.array(z.string()).readonly(),
  ).optional(),
}).strict() satisfies z.ZodType<Entity>;

// Events that come down from a loo
const zUpdates = z.object({
  type: z.literal("updates"),
  updates: zUpdate.array().readonly(),
});

export type Update = z.infer<typeof zUpdates>["updates"][number];

const zColorChange = z.object({
  type: z.literal("colorChange"),
  id: z.string(),
  color: z.string(),
});

const zNameChange = z.object({
  type: z.literal("nameChange"),
  id: z.string(),
  name: z.string(),
});

const zRound = z.object({
  sheep: z.string().array().readonly(),
  wolves: z.string().array().readonly(),
  duration: z.number(),
});

const zLobbySettings = z.object({
  mode: z.union([z.literal("survival"), z.literal("vip")]),
  vipHandicap: z.number(),
  sheep: z.number(),
  autoSheep: z.boolean(),
  time: z.number(),
  autoTime: z.boolean(),
  startingGold: z.object({
    sheep: z.number(),
    wolves: z.number(),
  }),
  income: z.object({
    sheep: z.number(),
    wolves: z.number(),
  }),
});

export type LobbySettings = z.input<typeof zLobbySettings>;

const zJoin = z.object({
  type: z.literal("join"),
  status: z.union([z.literal("lobby"), z.literal("playing")]),
  players: z.object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    team: zTeam,
    local: z.boolean().optional().default(false),
    host: z.boolean().optional().default(false),
    sheepCount: z.number(),
  }).array().readonly(),
  updates: zUpdate.array().readonly(),
  rounds: zRound.array().readonly().optional(),
  lobbySettings: zLobbySettings,
});

const zLeave = z.object({
  type: z.literal("leave"),
  player: z.string(),
  host: z.string().optional(),
  lobbySettings: zLobbySettings,
});

const zStop = z.object({
  type: z.literal("stop"),
  // Sent if round canceled to revert sheepCount
  players: z.object({ id: z.string(), sheepCount: z.number() }).array()
    .readonly()
    .optional(),
  // Sent if round not canceled
  round: zRound.optional(),
});

const zPong = z.object({
  type: z.literal("pong"),
  time: z.number(),
  data: z.unknown(),
});

const zChat = z.object({
  type: z.literal("chat"),
  player: z.string().optional(),
  message: z.string(),
});

const zLobbySettingsMessage = zLobbySettings.extend({
  type: z.literal("lobbySettings"),
});

const zLobby = z.object({
  name: z.string(),
  playerCount: z.number(),
  status: z.union([z.literal("lobby"), z.literal("playing")]),
});

export type Lobby = z.infer<typeof zLobby>;

const zHubState = z.object({
  type: z.literal("hubState"),
  lobbies: z.array(zLobby).readonly(),
});

export const zMessage = z.discriminatedUnion("type", [
  zStart,
  zUpdates,
  zColorChange,
  zNameChange,
  zJoin,
  zLeave,
  zStop,
  zPong,
  zChat,
  zLobbySettingsMessage,
  zHubState,
]);

export type ServerToClientMessage = z.input<typeof zMessage>;
