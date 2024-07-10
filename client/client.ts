import z from "npm:zod";
import { playersVar } from "./ui/vars/players.ts";
import { stateVar } from "./ui/vars/state.ts";
import { app, Entity } from "./ecs.ts";
import { type ClientToServerMessage } from "../server/client.ts";

const zStart = z.object({
  type: z.literal("start"),
  sheep: z.string().array(),
  wolves: z.string().array(),
});

// Events that come down from a loo
const zUpdates = z.object({
  type: z.literal("updates"),
  updates: z.union([
    z.object({
      type: z.literal("newUnit"),
      id: z.string(),
      kind: z.union([
        z.literal("sheep"),
        z.literal("wolf"),
        z.literal("hut"),
        z.literal("house"),
      ]),
      owner: z.string(),
      facing: z.number(),
      mana: z.number().optional(),
      movement: z.object({ x: z.number(), y: z.number() }).array(),
    }),
    z.object({
      type: z.literal("updateUnit"),
      id: z.string(),
      owner: z.string().optional(),
      facing: z.number().optional(),
      mana: z.number().optional(),
      movement: z.object({ x: z.number(), y: z.number() }).array()
        .optional(),
    }),
  ]).array(),
});

const zSlotChange = z.object({
  type: z.literal("slotChange"),
  id: z.string(),
  slot: z.number(),
});

const zJoin = z.object({
  type: z.literal("join"),
  players: z.object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    team: z.union([
      z.literal("sheep"),
      z.literal("wolf"),
      z.literal("wisp"),
      z.literal("observer"),
      z.literal("pending"),
    ]),
  }).array(),
});

const zMessage = z.union([
  zStart,
  zUpdates,
  zSlotChange,
  zJoin,
]);

export type ServerToClientMessage = z.TypeOf<typeof zMessage>;

const map: Record<string, Entity> = {};

const handlers = {
  join: (data: z.TypeOf<typeof zJoin>) => playersVar(data.players),
  slotChange: (data: z.TypeOf<typeof zSlotChange>) => {
  },
  start: (data: z.TypeOf<typeof zStart>) => {
    stateVar("playing");
  },
  updates: (data: z.TypeOf<typeof zUpdates>) => {
    for (const update of data.updates) {
      if (update.type === "newUnit" || update.type === "updateUnit") {
        const { type, ...props } = update;
        if (update.id in map) Object.assign(map[update.id], props);
        else map[update.id] = app.add(props);
        // app.add({
        //   id: update.id,
        //   owner: update.owner,
        //   facing: update.facing,
        //   movement: update.movement,
        //   mana: update.mana,
        //   ...(update.type === "newUnit" ? {} : {}),
        // });
        // const collection = collections[update.kind];

        // if (update.type === "newUnit") {
        //   collection.setColorAt(
        //     update.id,
        //     playerColors[parseInt(update.owner.split("-")[1])],
        //   );
        // }

        // collection.setPositionAt(
        //   update.id,
        //   update.movement[0].x,
        //   update.movement[0].y,
        // );

        // if ((update.movement?.length ?? 0) > 1) {
        //   flagUnitMovement(update);
        // }
      }
    }
  },
};

let ws: WebSocket;

const connect = () => {
  ws = new WebSocket(
    `ws${location.protocol === "https:" ? "s" : ""}//${location.host}`,
  );
  ws.addEventListener("close", connect);
  ws.addEventListener("message", (e) => {
    const data = zMessage.parse(JSON.parse(e.data));
    handlers[data.type](data as any);
  });
};
connect();

export const send = (message: ClientToServerMessage) => {
  ws.send(JSON.stringify(message));
};
