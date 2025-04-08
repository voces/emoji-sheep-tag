import z from "npm:zod";
import { playersVar } from "./ui/vars/players.ts";
import { connectionStatusVar, stateVar } from "./ui/vars/state.ts";
import { app, Entity } from "./ecs.ts";
import { type ClientToServerMessage } from "../server/client.ts";
import { zTeam } from "../shared/zod.ts";
import { camera } from "./graphics/three.ts";
import { center, tiles } from "../shared/map.ts";
import { stats } from "./util/Stats.ts";
import { LocalWebSocket } from "./local.ts";
import { data } from "./data.ts";
import { addChatMessage } from "./ui/pages/Game/Chat.tsx";

const zPoint = z.object({ x: z.number(), y: z.number() });

const zStart = z.object({
  type: z.literal("start"),
  sheep: z.string().array(),
  wolves: z.string().array(),
});

const zAction = z.union([
  z.object({
    type: z.literal("walk"),
    target: z.union([z.string(), zPoint]),
    path: zPoint.array(),
  }),
  z.object({
    type: z.literal("build"),
    unitType: z.string(),
    x: z.number(),
    y: z.number(),
  }),
  z.object({
    type: z.literal("attack"),
    target: z.string(),
  }),
  z.object({ type: z.literal("hold") }),
]).readonly();

const zUpdate = z.object({
  type: z.literal("unit"),
  id: z.string(),

  // Data
  unitType: z.string().optional(),
  owner: z.string().optional(),
  health: z.number().optional(),
  maxHealth: z.number().optional(),
  mana: z.number().optional(),
  position: zPoint.readonly().optional(),
  movementSpeed: z.number().optional(),
  facing: z.number().optional(),
  turnSpeed: z.number().optional(),
  actions: z.array(
    z.union([
      z.object({
        type: z.literal("build"),
        unitType: z.string(),
        binding: z.array(z.string()).optional(),
      }),
      z.object({
        type: z.literal("auto"),
        order: z.string(),
        binding: z.array(z.string()).optional(),
      }),
    ]),
  ).readonly().optional(),
  attack: z.object({
    damage: z.number(),
    range: z.number(),
    rangeMotionBuffer: z.number(),
    cooldown: z.number(),
    damagePoint: z.number(),
    backswing: z.number(),
  }).optional(),
  isDoodad: z.boolean().nullable().optional(),

  swing: z.object({
    time: z.number(),
    source: z.object({ x: z.number(), y: z.number() }),
    target: z.object({ x: z.number(), y: z.number() }),
  }).nullable().optional(),
  lastAttack: z.number().optional(),

  // Tags
  isMoving: z.boolean().nullable().optional(),
  isAttacking: z.boolean().nullable().optional(),
  isIdle: z.boolean().nullable().optional(),

  // Pathing
  radius: z.number().optional(),
  pathing: z.number().optional(),
  requiresPathing: z.number().optional(),
  blocksPathing: z.number().optional(),
  tilemap: z.object({
    top: z.number(),
    left: z.number(),
    height: z.number(),
    width: z.number(),
    map: z.number().array(),
  }).optional(),
  structure: z.boolean().optional(),

  // Actions
  action: zAction.nullable().optional(),
  queue: zAction.array().readonly().nullable().optional(),

  // Art
  model: z.string().optional(),
  modelScale: z.number().optional(),
  sounds: z.object({
    attack: z.array(z.string()).optional(),
    death: z.array(z.string()).optional(),
    ready: z.array(z.string()).optional(),
    what: z.array(z.string()).optional(),
    yes: z.array(z.string()).optional(),
  }).optional(),
}).strict();

const zDelete = z.object({
  type: z.literal("delete"),
  id: z.string(),
});

// Events that come down from a loo
const zUpdates = z.object({
  type: z.literal("updates"),
  updates: z.union([zUpdate, zDelete]).array(),
});

const zColorChange = z.object({
  type: z.literal("colorChange"),
  id: z.string(),
  color: z.string(),
});

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
  }).array(),
  updates: zUpdate.array(),
});

const zLeave = z.object({
  type: z.literal("leave"),
  player: z.string(),
  host: z.string().optional(),
});

const zStop = z.object({
  type: z.literal("stop"),
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
      prevPlayers.some((p2) => p2.id !== p.id)
    );
    playersVar((prev) =>
      data.players.length !== 1 || data.players.some((p) => p.local)
        ? data.players
        : prev.some((p) => p.id === data.players[0].id)
        ? prev
        : [...prev, data.players[0]]
    );
    if (newPlayers.length) {
      addChatMessage(`${
        new Intl.ListFormat().format(
          newPlayers.map((p) => `|c${p.color}|${p.name}|`),
        )
      } ${newPlayers.length > 1 ? "have" : "has"} joined the game!`);
    }
    stateVar(data.status);
    if (data.status === "lobby") {
      console.log("status lobby");
      for (const entity of app.entities) app.delete(entity);
    }
    for (const update of data.updates) {
      const { type, ...props } = update;
      if (update.id in map) Object.assign(map[update.id], props);
      else map[update.id] = app.add(props);
    }
  },
  colorChange: (data: z.TypeOf<typeof zColorChange>) => {
    playersVar((players) =>
      players.map((p) => p.id === data.id ? { ...p, color: data.color } : p)
    );
  },
  start: (e: z.TypeOf<typeof zStart>) => {
    const players = playersVar();
    data.sheep = players.filter((p) => e.sheep.includes(p.id));
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
      app.add({
        id: `grass-${crypto.randomUUID()}`,
        unitType: "grass",
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
      app.add({
        id: `flowers-${crypto.randomUUID()}`,
        unitType: "flowers",
        position: { x, y },
        playerColor: `#${Math.floor(r * scale).toString(16).padStart(2, "0")}${
          Math.floor(g * scale).toString(16).padStart(2, "0")
        }${Math.floor(b * scale).toString(16).padStart(2, "0")}`,
        facing: Math.round(Math.random()) * Math.PI,
      });
    }
  },
  stop: () => {
    stateVar("lobby");
    for (const entity of app.entities) app.delete(entity);
  },
  updates: (data: z.TypeOf<typeof zUpdates>) => {
    for (const update of data.updates) {
      if (update.type === "unit") {
        const { type, ...props } = update;
        if (update.id in map) Object.assign(map[update.id], props);
        else map[update.id] = app.add(props);
      } else if (update.type === "delete") {
        if (update.id in map) {
          app.delete(map[update.id]);
          delete map[update.id];
        }
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
    if (p) addChatMessage(`|c${p.color}|${p.name}| has left the game!`);
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

let server = location.host;
export const setServer = (value: string) => server = value;

export const connect = () => {
  if (ws) return;
  ws = server === "local" ? new LocalWebSocket() : new WebSocket(
    `ws${location.protocol === "https:" ? "s" : ""}//${server}`,
  );
  ws.addEventListener("close", () => {
    connectionStatusVar("disconnected");
    ws = undefined;
    connect();
  });
  ws.addEventListener("open", () => connectionStatusVar("connected"));
  ws.addEventListener("message", (e) => {
    const json = JSON.parse(e.data);
    let data: ServerToClientMessage;
    try {
      data = zMessage.parse(json);
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.error(...err.issues);
      }
      throw err;
    }
    // console.log(data);

    delay(() => handlers[data.type](data as any));
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
    } catch {}
  });
};

setInterval(() => {
  if (ws?.readyState !== WebSocket.OPEN) return;
  const time = performance.now();
  send({ type: "ping", data: time });
}, 1000);
