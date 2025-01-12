import z from "npm:zod";
import { playersVar } from "./ui/vars/players.ts";
import { connectionStatusVar, stateVar } from "./ui/vars/state.ts";
import { app, Entity } from "./ecs.ts";
import { type ClientToServerMessage } from "../server/client.ts";
import { zTeam } from "../shared/zod.ts";
import { camera } from "./graphics/three.ts";
import { center } from "../shared/map.ts";
import { stats } from "./util/Stats.ts";
import { LocalWebSocket } from "./local.ts";
import { data } from "./data.ts";

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

const zSlotChange = z.object({
  type: z.literal("slotChange"),
  id: z.string(),
  slot: z.number(),
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

const zMessage = z.union([
  zStart,
  zUpdates,
  zSlotChange,
  zJoin,
  zLeave,
  zStop,
  zPong,
]);

export type ServerToClientMessage = z.input<typeof zMessage>;

const map: Record<string, Entity> = {};

const handlers = {
  join: (data: z.TypeOf<typeof zJoin>) => {
    playersVar((prev) =>
      data.players.length !== 1 || data.players.some((p) => p.local)
        ? data.players
        : prev.some((p) => p.id === data.players[0].id)
        ? prev
        : [...prev, data.players[0]]
    );
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
  slotChange: (data: z.TypeOf<typeof zSlotChange>) => {
  },
  start: (e: z.TypeOf<typeof zStart>) => {
    const players = playersVar();
    data.sheep = players.filter((p) => e.sheep.includes(p.id));
    data.wolves = players.filter((p) => e.wolves.includes(p.id));
    stateVar("playing");
    camera.position.x = center.x;
    camera.position.y = center.y;
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
  leave: (data: z.TypeOf<typeof zLeave>) =>
    playersVar((players) =>
      players.filter((p) => p.id !== data.player).map((p) =>
        !p.host && data.host === p.id ? { ...p, host: true } : p
      )
    ),
  pong: ({ data }: z.TypeOf<typeof zPong>) => {
    if (typeof data === "number") {
      stats.msPanel.update(performance.now() - data, 100);
    }
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
