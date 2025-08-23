import z from "npm:zod";
import { zTeam } from "@/shared/zod.ts";

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
    type: z.literal("attack"),
    targetId: z.string(),
    path: zPoint.array().readonly().optional(),
  }),
  z.object({ type: z.literal("hold") }),
  z.object({
    type: z.literal("cast"),
    orderId: z.string(),
    remaining: z.number(),
    positions: z.array(zPoint).readonly().optional(),
    target: zPoint.optional(),
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
  z.literal("ally"),
  z.literal("enemy"),
  z.literal("neutral"),
  z.literal("self"),
  z.literal("other"),
]);

// Define the base action types first (non-recursive)
const zBaseAction = z.union([
  z.object({
    name: z.string(),
    type: z.literal("build"),
    unitType: z.string(),
    binding: z.array(z.string()).readonly().optional(),
    manaCost: z.number().optional(),
    goldCost: z.number().optional(),
    castDuration: z.number().optional(),
  }),
  z.object({
    name: z.string(),
    type: z.literal("auto"),
    order: z.string(),
    binding: z.array(z.string()).readonly().optional(),
    manaCost: z.number().optional(),
    castDuration: z.number().optional(),
    buffDuration: z.number().optional(),
    attackSpeedMultiplier: z.number().optional(),
    movementSpeedBonus: z.number().optional(),
    movementSpeedMultiplier: z.number().optional(),
    soundOnCastStart: z.string().optional(),
  }),
  z.object({
    name: z.string(),
    type: z.literal("purchase"),
    itemId: z.string(),
    binding: z.array(z.string()).readonly().optional(),
    goldCost: z.number(),
    manaCost: z.number().optional(),
    castDuration: z.number().optional(),
  }),
  z.object({
    name: z.string(),
    type: z.literal("target"),
    order: z.string(),
    targeting: z.array(zClassification).readonly().optional(),
    aoe: z.number().optional(),
    binding: z.array(z.string()).readonly().optional(),
    smart: z.partialRecord(
      z.union([zClassification, z.literal("ground")]),
      z.number(),
    ).optional(),
    manaCost: z.number().optional(),
    castDuration: z.number().optional(),
    range: z.number().optional(),
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
      binding: z.array(z.string()).readonly().optional(),
      actions: z.array(zAction).readonly(),
    }),
  ])
);

const zItem = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().optional(),
  gold: z.number(),
  binding: z.string().array().readonly(),
  damage: z.number().optional(),
  attackSpeedMultiplier: z.number().optional(),
  movementSpeedBonus: z.number().optional(),
  charges: z.number().optional(),
  actions: z.array(zAction).readonly().optional(),
});

const zBuff = z.object({
  remainingDuration: z.number(),
  attackSpeedMultiplier: z.number().optional(),
  movementSpeedBonus: z.number().optional(),
  movementSpeedMultiplier: z.number().optional(),
  expiration: z.string().optional(),
});

const zUpdate = z.object({
  id: z.string(),
  __delete: z.boolean().optional(),

  // Data
  prefab: z.string().optional(),
  name: z.string().optional(),
  owner: z.string().optional(),
  health: z.number().optional(),
  maxHealth: z.number().optional(),
  healthRegen: z.number().optional(),
  mana: z.number().optional(),
  maxMana: z.number().optional(),
  manaRegen: z.number().optional(),

  // Player data
  isPlayer: z.boolean().optional(),
  gold: z.number().optional(),

  position: zPoint.optional(),
  movementSpeed: z.number().optional(),
  facing: z.number().optional(),
  turnSpeed: z.number().optional(),
  actions: z.array(zAction).readonly().optional(),
  attack: z.object({
    damage: z.number(),
    range: z.number(),
    rangeMotionBuffer: z.number(),
    cooldown: z.number(),
    damagePoint: z.number(),
    backswing: z.number(),
  }).optional(),
  completionTime: z.number().optional(),
  progress: z.number().nullable().optional(),
  isDoodad: z.boolean().nullable().optional(),

  swing: z.object({
    remaining: z.number(),
    source: z.object({ x: z.number(), y: z.number() }),
    target: z.object({ x: z.number(), y: z.number() }),
  }).nullable().optional(),
  attackCooldownRemaining: z.number().nullable().optional(),
  lastAttacker: z.string().nullable().optional(),

  isMirror: z.boolean().optional(),
  mirrors: z.array(z.string()).readonly().nullable().optional(),

  // Items
  inventory: zItem.array().readonly().optional(),

  // Buffs
  buffs: zBuff.array().readonly().nullable().optional(),

  // Bounty
  bounty: z.number().optional(),

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
  model: z.string().optional(),
  modelScale: z.number().optional(),
  sounds: z.object({
    birth: z.array(z.string()).readonly().optional(),
    attack: z.array(z.string()).readonly().optional(),
    death: z.array(z.string()).readonly().optional(),
    ready: z.array(z.string()).readonly().optional(),
    what: z.array(z.string()).readonly().optional(),
    yes: z.array(z.string()).readonly().optional(),
  }).optional(),
}).strict();

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

export const zFormat = z.object({ sheep: z.number(), wolves: z.number() });

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
  format: zFormat,
  updates: zUpdate.array().readonly(),
  rounds: zRound.array().readonly().optional(),
  lobbySettings: z.object({
    startingGold: z.object({
      sheep: z.number(),
      wolves: z.number(),
    }),
  }).optional(),
});

const zLeave = z.object({
  type: z.literal("leave"),
  player: z.string(),
  host: z.string().optional(),
  format: zFormat,
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

const zLobbySettings = z.object({
  type: z.literal("lobbySettings"),
  startingGold: z.object({
    sheep: z.number(),
    wolves: z.number(),
  }),
});

export const zMessage = z.union([
  zStart,
  zUpdates,
  zColorChange,
  zNameChange,
  zJoin,
  zLeave,
  zStop,
  zPong,
  zChat,
  zLobbySettings,
]);

export type ServerToClientMessage = z.input<typeof zMessage>;
