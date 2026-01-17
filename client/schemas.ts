import z from "zod";
import { Entity } from "@/shared/types.ts";
import { zShardInfo } from "@/shared/shard.ts";
export type { ShardInfo } from "@/shared/shard.ts";

const zPoint = z.object({ x: z.number(), y: z.number() }).readonly();

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
    iconEffect: zIconEffect.optional(),
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
    cooldown: z.number().optional(),
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
    animation: z.string().optional(),
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
    // TODO: remove?
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
  name: z.string().optional(),
  description: z.string().optional(),
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
  modelPlayerColor: z.string().optional(),
  modelAlpha: z.number().optional(),
  particleRate: z.number().optional(),
  particleOffsetRange: z.number().optional(),
  particleMinOffsetRange: z.number().optional(),
  particleScaleRange: z.number().optional(),
  particleLifetime: z.number().optional(),
  preventsBuffs: z.string().array().readonly().optional(),
  invisible: z.boolean().optional(),
});

const zItem = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
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
  trueOwner: z.string().optional(),
  type: z.union([
    z.literal("cosmetic"),
    z.literal("static"),
    z.literal("dynamic"),
  ]).optional(),
  health: z.number().nullable().optional(),
  maxHealth: z.number().optional(),
  healthRegen: z.number().optional(),
  mana: z.number().nullable().optional(),
  maxMana: z.number().nullable().optional(),
  manaRegen: z.number().nullable().optional(),

  // Player data
  isPlayer: z.boolean().optional(),
  isTeam: z.boolean().optional(),
  team: z.union([
    z.literal("pending"),
    z.literal("observer"),
    z.literal("sheep"),
    z.literal("wolf"),
  ]).optional(),
  gold: z.number().optional(),
  handicap: z.number().optional(),
  sheepTime: z.number().optional(),
  sheepCount: z.number().optional(),

  position: zPoint.optional(),
  movementSpeed: z.number().optional(),
  facing: z.number().nullable().optional(),
  turnSpeed: z.number().optional(),
  sightRadius: z.number().optional(),
  trueVision: z.boolean().optional(),
  gait: z.object({
    duration: z.number(),
    components: z.array(
      z.object({
        radiusX: z.number(),
        radiusY: z.number(),
        frequency: z.number(),
        phase: z.number(),
      }).readonly(),
    ).readonly(),
  }).optional(),
  actions: z.array(zAction).readonly().optional(),
  completionTime: z.number().nullable().optional(),
  progress: z.number().nullable().optional(),
  isDoodad: z.boolean().nullable().optional(),
  isTimer: z.boolean().optional(),
  isFloatingText: z.boolean().optional(),
  teamScoped: z.boolean().optional(),
  selectedBy: z.string().array().readonly().nullable().optional(),

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
    tumble: z.number().optional(),
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

  unique: z.boolean().optional(),

  // Pathing
  radius: z.number().optional(),
  pathing: z.number().optional(),
  requiresPathing: z.number().optional(),
  blocksPathing: z.number().optional(),
  tilemap: zTilemap.optional(),
  requiresTilemap: zTilemap.optional(),
  structure: z.boolean().optional(),
  penAreaIndex: z.number().optional(),

  // Orders
  order: zOrder.nullable().optional(),
  queue: zOrder.array().readonly().nullable().optional(),

  // Action cooldowns (keyed by order ID)
  actionCooldowns: z.record(z.string(), z.number()).readonly().nullable()
    .optional(),

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
      z.literal("projectileHit"),
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

const zStart = z.object({
  type: z.literal("start"),
  updates: zUpdate.array().readonly().optional(),
  practice: z.boolean().optional(),
});

const zRound = z.object({
  sheep: z.string().array().readonly(),
  wolves: z.string().array().readonly(),
  duration: z.number(),
});

const zLobbySettings = z.object({
  host: z.string().nullable(),
  map: z.string(),
  mode: z.union([
    z.literal("survival"),
    z.literal("vip"),
    z.literal("switch"),
    z.literal("vamp"),
  ]),
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
  editor: z.boolean().optional(),
  practice: z.boolean().optional(),
  view: z.boolean(),
  teamGold: z.boolean(),
  shard: z.string().nullable(),
  shards: z.array(zShardInfo).readonly(),
});

export type LobbySettings = z.input<typeof zLobbySettings>;

const zCaptainsDraft = z.object({
  phase: z.union([
    z.literal("selecting-captains"),
    z.literal("drafting"),
    z.literal("drafted"),
    z.literal("reversed"),
  ]),
  captains: z.string().array().readonly(),
  picks: z.tuple([
    z.string().array().readonly(),
    z.string().array().readonly(),
  ]),
  currentPicker: z.union([z.literal(0), z.literal(1)]),
  picksThisTurn: z.number(),
});

export type DefinedCaptainsDraft = z.input<typeof zCaptainsDraft>;
export type CaptainsDraft = DefinedCaptainsDraft | undefined;

const zJoin = z.object({
  type: z.literal("join"),
  lobby: z.string(),
  status: z.union([
    z.literal("lobby"),
    z.literal("playing"),
  ]),
  updates: zUpdate.array().readonly(),
  rounds: zRound.array().readonly().optional(),
  lobbySettings: zLobbySettings,
  localPlayer: z.string().optional(),
  captainsDraft: zCaptainsDraft.nullable(),
});

const zLeave = z.object({
  type: z.literal("leave"),
  updates: zUpdate.array().readonly(),
  lobbySettings: zLobbySettings,
});

const zStop = z.object({
  type: z.literal("stop"),
  // Sent if round canceled to revert sheepCount
  updates: zUpdate.array().readonly().optional(),
  // Sent if round not canceled
  round: zRound.optional(),
});

const zPong = z.object({
  type: z.literal("pong"),
  time: z.number(),
  data: z.unknown(),
});

const zChatChannel = z.enum(["all", "allies"]);

const zChat = z.object({
  type: z.literal("chat"),
  player: z.string().optional(),
  message: z.string(),
  channel: zChatChannel.optional(),
});

const zLobbySettingsMessage = zLobbySettings.extend({
  type: z.literal("lobbySettings"),
});

const zCaptainsDraftMessage = z.object({
  type: z.literal("captainsDraft"),
  phase: z.union([
    z.literal("selecting-captains"),
    z.literal("drafting"),
    z.literal("drafted"),
    z.literal("reversed"),
  ]).optional(),
  captains: z.string().array().readonly().optional(),
  picks: z.tuple([z.string().array().readonly(), z.string().array().readonly()])
    .optional(),
  currentPicker: z.union([z.literal(0), z.literal(1)]).optional(),
  picksThisTurn: z.number().optional(),
});

const zLobby = z.object({
  name: z.string(),
  playerCount: z.number(),
  status: z.union([
    z.literal("lobby"),
    z.literal("playing"),
  ]),
  isOpen: z.boolean(),
});

export type Lobby = z.infer<typeof zLobby>;

const zHubState = z.object({
  type: z.literal("hubState"),
  lobbies: z.array(zLobby).readonly(),
});

const zMapUpdate = z.object({
  type: z.literal("mapUpdate"),
  terrain: z.string(),
  cliffs: z.string(),
  width: z.number(),
  height: z.number(),
  bounds: z.object({
    min: z.object({ x: z.number(), y: z.number() }),
    max: z.object({ x: z.number(), y: z.number() }),
  }),
  center: z.object({ x: z.number(), y: z.number() }),
});

const zUploadCustomMap = z.object({
  type: z.literal("uploadCustomMap"),
  mapId: z.string(),
  mapData: z.unknown(),
});

const zConnectToShard = z.object({
  type: z.literal("connectToShard"),
  shardUrl: z.string(),
  token: z.string(),
  lobbyId: z.string(),
});

const zShards = z.object({
  type: z.literal("shards"),
  shards: z.array(zShardInfo).readonly(),
});

const zVip = z.object({
  type: z.literal("vip"),
  playerId: z.string(),
});

export const zMessage = z.discriminatedUnion("type", [
  zStart,
  zUpdates,
  zJoin,
  zLeave,
  zStop,
  zPong,
  zChat,
  zLobbySettingsMessage,
  zCaptainsDraftMessage,
  zHubState,
  zMapUpdate,
  zUploadCustomMap,
  zConnectToShard,
  zShards,
  zVip,
]);

export type ServerToClientMessage = z.input<typeof zMessage>;
