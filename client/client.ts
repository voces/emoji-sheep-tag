import z from "npm:zod";
import { getPlayer, playersVar } from "./ui/vars/players.ts";
import { connectionStatusVar, stateVar } from "./ui/vars/state.ts";
import { app, Entity } from "./ecs.ts";
import { type ClientToServerMessage } from "../server/client.ts";
import { zTeam } from "@/shared/zod.ts";
import { camera } from "./graphics/three.ts";
import { center, tiles } from "@/shared/map.ts";
import { stats } from "./util/Stats.ts";
import { LocalWebSocket } from "./local.ts";
import { data } from "./data.ts";
import { addChatMessage } from "./ui/vars/chat.ts";
import { roundsVar } from "./ui/vars/rounds.ts";
import { formatVar } from "./ui/vars/format.ts";
import { format } from "./api/player.ts";
import { getStoredPlayerName } from "./util/playerPrefs.ts";
import { playSound } from "./api/sound.ts";
import { absurd } from "@/shared/util/absurd.ts";

const zPoint = z.object({ x: z.number(), y: z.number() });

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
  }),
]);

// Define the recursive action type using z.lazy with proper typing
type ActionType = z.infer<typeof zBaseAction> | {
  name: string;
  type: "menu";
  binding?: ReadonlyArray<string>;
  actions: ReadonlyArray<ActionType>;
};

const zAction: z.ZodType<ActionType> = z.lazy(() =>
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
});

const zUpdate = z.object({
  type: z.literal("unit"),
  id: z.string(),

  // Data
  prefab: z.string().optional(),
  name: z.string().optional(),
  owner: z.string().optional(),
  health: z.number().optional(),
  maxHealth: z.number().optional(),
  mana: z.number().optional(),
  maxMana: z.number().optional(),
  manaRegen: z.number().optional(),

  // Player data
  isPlayer: z.boolean().optional(),
  gold: z.number().optional(),

  position: zPoint.readonly().optional(),
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

  isMirror: z.boolean().optional(),
  mirrors: z.array(z.string()).readonly().nullable().optional(),

  // Items
  inventory: zItem.array().readonly().optional(),

  // Buffs
  buffs: zBuff.array().readonly().nullable().optional(),

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
    attack: z.array(z.string()).readonly().optional(),
    death: z.array(z.string()).readonly().optional(),
    ready: z.array(z.string()).readonly().optional(),
    what: z.array(z.string()).readonly().optional(),
    yes: z.array(z.string()).readonly().optional(),
  }).optional(),
}).strict();

const zDelete = z.object({
  type: z.literal("delete"),
  id: z.string(),
});

const zKill = z.object({
  type: z.literal("kill"),
  killer: z.object({ player: z.string(), unit: z.string() }),
  victim: z.object({ player: z.string(), unit: z.string() }),
});

const zSound = z.object({
  type: z.literal("sound"),
  soundKey: z.string(),
  volume: z.number().optional(),
});

const zGameMessage = z.union([zKill, zSound]);

export type GameMessage = z.TypeOf<typeof zGameMessage>;

// Events that come down from a loo
const zUpdates = z.object({
  type: z.literal("updates"),
  updates: z.union([zUpdate, zDelete, zKill, zSound]).array().readonly(),
});

export type Update = z.TypeOf<typeof zUpdates>["updates"][number];

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

const zMessage = z.union([
  zStart,
  zUpdates,
  zColorChange,
  zNameChange,
  zJoin,
  zLeave,
  zStop,
  zPong,
  zChat,
]);

export type ServerToClientMessage = z.input<typeof zMessage>;

const map: Record<string, Entity> = {};

const checkNearPathing = (
  x: number,
  y: number,
  near: number,
  pathing: number,
) => {
  if (tiles[Math.floor(y)]?.[Math.floor(x)] ?? 255 & pathing) return true;
  if (tiles[Math.floor(y + near)]?.[Math.floor(x)] ?? 255 & pathing) {
    return true;
  }
  if (tiles[Math.floor(y - near)]?.[Math.floor(x)] ?? 255 & pathing) {
    return true;
  }
  if (tiles[Math.floor(y)]?.[Math.floor(x + near)] ?? 255 & pathing) {
    return true;
  }
  if (tiles[Math.floor(y + near)]?.[Math.floor(x + near)] ?? 255 & pathing) {
    return true;
  }
  if (tiles[Math.floor(y - near)]?.[Math.floor(x + near)] ?? 255 & pathing) {
    return true;
  }
  if (tiles[Math.floor(y)]?.[Math.floor(x - near)] ?? 255 & pathing) {
    return true;
  }
  if (tiles[Math.floor(y + near)]?.[Math.floor(x - near)] ?? 255 & pathing) {
    return true;
  }
  if (tiles[Math.floor(y - near)]?.[Math.floor(x - near)] ?? 255 & pathing) {
    return true;
  }
  return false;
};

const handlers = {
  join: (data: z.TypeOf<typeof zJoin>) => {
    const prevPlayers = playersVar();
    const newPlayers = data.players.filter((p) =>
      !prevPlayers.some((p2) => p2.id === p.id) && !p.local
    );
    playersVar((prev) =>
      data.players.length !== 1 || data.players.some((p) => p.local)
        // Fully set players if we receive multiple or it includes local
        ? data.players
        : prev.some((p) => p.id === data.players[0].id)
        // Use previous players if we receive 1 player and they are already known
        ? prev
        // Otherwise append the one new player
        : [...prev, data.players[0]]
    );
    formatVar(data.format);
    if (newPlayers.length) {
      addChatMessage(`${
        new Intl.ListFormat().format(
          newPlayers.map((p) => `|c${p.color}|${p.name}|`),
        )
      } ${newPlayers.length > 1 ? "have" : "has"} joined the game!`);
    }
    stateVar(data.status);
    if (data.status === "lobby") {
      for (const entity of app.entities) app.removeEntity(entity);
      for (const key in map) delete map[key];
    }
    for (const update of data.updates) {
      const { type: _type, ...props } = update;
      if (update.id in map) Object.assign(map[update.id], props);
      else map[update.id] = app.addEntity(props);
    }
    if (data.rounds) roundsVar(data.rounds);
  },
  colorChange: (data: z.TypeOf<typeof zColorChange>) => {
    playersVar((players) =>
      players.map((p) => p.id === data.id ? { ...p, color: data.color } : p)
    );
  },
  nameChange: (data: z.TypeOf<typeof zNameChange>) => {
    playersVar((players) =>
      players.map((p) => p.id === data.id ? { ...p, name: data.name } : p)
    );
  },
  start: (e: z.TypeOf<typeof zStart>) => {
    const players = playersVar((players) =>
      players.map((p) => {
        const s = e.sheep.find((s) => s.id === p.id);
        return s ? { ...p, sheepCount: s.sheepCount } : p;
      })
    );
    data.sheep = players.filter((p) => e.sheep.some((s) => s.id === p.id));
    data.wolves = players.filter((p) => e.wolves.includes(p.id));
    stateVar("playing");
    camera.position.x = center.x;
    camera.position.y = center.y;
    for (let i = 0; i < tiles[0].length * tiles.length / 3; i++) {
      const x = Math.random() * tiles[0].length;
      const y = Math.random() * tiles.length;
      const r = Math.round(37 + (Math.random() - 0.5) * 30);
      const g = Math.round(102 + (Math.random() - 0.5) * 45);
      if (checkNearPathing(x, y, 0.25, 255)) continue;
      app.addEntity({
        id: `grass-${crypto.randomUUID()}`,
        prefab: "grass",
        position: { x, y },
        playerColor: `#${r.toString(16)}${g.toString(16)}00`,
        facing: Math.round(Math.random()) * Math.PI,
      });
    }
    for (let i = 0; i < tiles[0].length * tiles.length / 20; i++) {
      const x = Math.random() * tiles[0].length;
      const y = Math.random() * tiles.length;
      if (checkNearPathing(x, y, 0.25, 255)) continue;
      const r = Math.random();
      const g = Math.random();
      const b = Math.random();
      const scale = Math.min(1 / r, 1 / g, 1 / b) * 255;
      app.addEntity({
        id: `flowers-${crypto.randomUUID()}`,
        prefab: "flowers",
        position: { x, y },
        playerColor: `#${Math.floor(r * scale).toString(16).padStart(2, "0")}${
          Math.floor(g * scale).toString(16).padStart(2, "0")
        }${Math.floor(b * scale).toString(16).padStart(2, "0")}`,
        facing: Math.round(Math.random()) * Math.PI,
      });
    }
  },
  stop: (d: z.TypeOf<typeof zStop>) => {
    stateVar("lobby");
    for (const entity of app.entities) app.removeEntity(entity);
    for (const key in map) delete map[key];
    if (d.players) {
      playersVar((players) =>
        players.map((p) => {
          const u = d.players?.find((p2) => p2.id === p.id);
          return u ? { ...p, sheepCount: u.sheepCount } : p;
        })
      );
    }
    if (d.round) roundsVar((r) => [...r, d.round!]);
  },
  updates: (data: z.TypeOf<typeof zUpdates>) => {
    for (const update of data.updates) {
      switch (update.type) {
        case "unit": {
          if (stateVar() !== "playing") break;
          const { type: _type, ...props } = update;
          if (update.id in map) Object.assign(map[update.id], props);
          else map[update.id] = app.addEntity(props);
          break;
        }
        case "delete": {
          if (stateVar() !== "playing") break;
          if (update.id in map) {
            app.removeEntity(map[update.id]);
            delete map[update.id];
          }
          break;
        }
        case "kill": {
          const killer = getPlayer(update.killer.player);
          const victim = getPlayer(update.victim.player);
          if (killer && victim) {
            addChatMessage(`${format(killer)} killed ${format(victim)}`);
          }
          break;
        }
        case "sound":
          // sound: ({ soundKey, volume }: z.TypeOf<typeof zSound>) => {
          // console.log("on sound?", { soundKey, volume });
          playSound(update.soundKey, { volume: update.volume });
          // },
          break;
        default:
          absurd(update);
      }
    }
  },
  leave: (data: z.TypeOf<typeof zLeave>) => {
    const p = playersVar().find((p) => p.id === data.player);
    playersVar((players) =>
      players.filter((p) => p.id !== data.player).map((p) =>
        !p.host && data.host === p.id ? { ...p, host: true } : p
      )
    );
    if (p) addChatMessage(`${format(p)} has left the game!`);
    formatVar(data.format);
  },
  pong: ({ data }: z.TypeOf<typeof zPong>) => {
    if (typeof data === "number") {
      stats.msPanel.update(performance.now() - data, 100);
    }
  },
  chat: ({ player, message }: z.TypeOf<typeof zChat>) => {
    const p = playersVar().find((p) => p.id === player);
    addChatMessage(p ? `|c${p.color}|${p.name}|: ${message}` : message);
  },
};

let ws: WebSocket | LocalWebSocket | undefined;

const delay = (fn: () => void) => {
  if (typeof latency !== "number" && typeof noise !== "number") {
    return fn();
  }

  const delay = (typeof latency === "number" ? latency : 0) +
    (typeof noise === "number" ? Math.random() * noise : 0);
  setTimeout(fn, delay);
};

let server = location?.host;
export const setServer = (value: string) => server = value;

export const connect = () => {
  if (ws) return;
  ws = server === "local" ? new LocalWebSocket() : new WebSocket(
    `ws${location.protocol === "https:" ? "s" : ""}://${server}`,
  );
  ws.addEventListener("close", () => {
    connectionStatusVar("disconnected");
    ws = undefined;
    connect();
  });
  ws.addEventListener("open", () => {
    connectionStatusVar("connected");
    // Send stored name if available
    const storedName = getStoredPlayerName();
    if (storedName) {
      send({
        type: "generic",
        event: { type: "nameChange", name: storedName },
      });
    }
  });
  ws.addEventListener("message", (e) => {
    const json = JSON.parse(e.data);
    let data: ServerToClientMessage;
    try {
      data = zMessage.parse(json);
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.error(json);
        console.error(...err.issues);
      }
      throw err;
    }
    // console.log(data);

    delay(() => handlers[data.type](data as never));
  });
};

declare global {
  var latency: unknown;
  var noise: unknown;
}

export const send = (message: ClientToServerMessage) => {
  delay(() => {
    try {
      ws?.send(JSON.stringify(message));
    } catch (err) {
      console.error(err);
      // do nothing
    }
  });
};

setInterval(() => {
  if (ws?.readyState !== WebSocket.OPEN) return;
  const time = performance.now();
  send({ type: "ping", data: time });
}, 1000);
