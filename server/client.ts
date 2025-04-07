import { z } from "npm:zod";

import type { ServerToClientMessage } from "../client/client.ts";
import { lobbies, type Lobby, newLobby } from "./lobby.ts";
import { clientContext, lobbyContext } from "./contexts.ts";
import { leave, send } from "./lobbyApi.ts";
import { build, zBuild } from "./actions/build.ts";
import { move, zMove } from "./actions/move.ts";
import { start, zStart } from "./actions/start.ts";
import { colors } from "../shared/data.ts";
import { attack, zAttack } from "./actions/attack.ts";
import { unitOrder, zOrderEvent } from "./actions/unitOrder.ts";
import { flushUpdates } from "./updates.ts";
import { ping, zPing } from "./actions/ping.ts";
import "./events/death.ts";
import "./st/index.ts";
import "./systems/autoAttack.ts";
import "./systems/kd.ts";
import "./systems/death.ts";
import { generic, zGenericEvent } from "./actions/generic.ts";
import { setSome } from "./util/set.ts";
import { chat, zChat } from "./actions/chat.ts";

type SocketEventMap = {
  close: unknown;
  error: unknown;
  message: { data: unknown };
  open: unknown;
};

type Socket = {
  readyState: number;
  send: (data: string) => void;
  close: () => void;
  addEventListener: <K extends keyof SocketEventMap>(
    type: K,
    listener: (this: Socket, ev: SocketEventMap[K]) => void,
  ) => void;
};

const wrap = <T extends (...args: any[]) => unknown>(
  client: Client,
  fn: (...args: Parameters<T>) => ReturnType<T>,
) =>
(...args: Parameters<T>) => {
  if (client.lobby) {
    return lobbyContext.with(
      client.lobby!,
      () => clientContext.with(client, () => fn(...args)),
    );
  }
  return clientContext.with(client, () => fn(...args));
};

let clientIndex = 0;
class Client {
  id: string;
  name: string;
  color: string;

  lobby?: Lobby;

  sheepCount = 0;

  constructor(readonly socket: Socket) {
    this.color = colors[0];
    this.id = `player-${clientIndex++}`;
    this.name = `Player ${clientIndex}`;
  }

  send(message: ServerToClientMessage) {
    if (this.socket.readyState !== WebSocket.OPEN) return;
    try {
      // console.log("S->C", message);
      this.socket.send(JSON.stringify(message));
    } catch (err) {
      console.error(err);
    }
  }

  rawSend(message: string) {
    if (this.socket.readyState !== WebSocket.OPEN) return;
    try {
      this.socket.send(message);
    } catch (err) {
      console.error(err);
      this.socket.close();
    }
  }
}
type ClientInstance = InstanceType<typeof Client>;
export type { ClientInstance as Client };

const zClientToServerMessage = z.union([
  zStart,
  zMove,
  zBuild,
  zAttack,
  zOrderEvent,
  zPing,
  zGenericEvent,
  zChat,
]);

export type ClientToServerMessage = z.TypeOf<typeof zClientToServerMessage>;

const actions = {
  start,
  move,
  build,
  attack,
  unitOrder,
  ping,
  generic,
  chat,
};

export const handleSocket = (socket: Socket) => {
  const client = new Client(socket);
  console.log(new Date(), "Client", client.id, "connected");

  clientContext.with(client, () => {
    if (!lobbies.size) return client.lobby = newLobby(client);

    const result = lobbies.values().next();
    if (result.done) throw new Error("Expected lobby");
    const lobby = client.lobby = result.value;
    lobbyContext.with(client.lobby, () => {
      lobby.settings.teams.set(client, "pending");
      client.color = colors.find((c) =>
        !setSome(lobby.players, (p) => p.color === c)
      ) ?? client.color;
      send({
        type: "join",
        status: lobby.status,
        players: [{
          id: client.id,
          name: client.name,
          color: client.color,
          team: "pending",
          host: false,
        }],
        updates: [],
      });
      client.sheepCount = Math.max(
        ...Array.from(lobby.players, (p) => p.sheepCount),
      );
      lobby.players.add(client);
      console.log(
        new Date(),
        "Client",
        client.id,
        "added to lobby",
        lobby.name,
      );
    });
  });

  socket.addEventListener(
    "open",
    wrap(client, () => {
      if (!client.lobby) return;
      client.send({
        type: "join",
        status: client.lobby.status,
        players: Array.from(
          client.lobby.players,
          (p) => ({
            id: p.id,
            name: p.name,
            color: p.color,
            team: client.lobby!.settings.teams.get(client)! ?? "pending",
            local: p === client ? true : undefined,
            host: client.lobby?.host === p,
          }),
        ),
        updates: Array.from(
          client.lobby.round?.ecs.entities ?? [],
          (e) => ({ type: "unit", ...e }),
        ),
      });
    }),
  );

  socket.addEventListener(
    "message",
    wrap<(e: SocketEventMap["message"]) => void>(client, (e) => {
      try {
        if (typeof e.data !== "string") {
          throw new Error("Expected data to be a string");
        }
        const json = JSON.parse(e.data);
        // console.log("C->S", json);
        const message = zClientToServerMessage.parse(json);
        try {
          actions[message.type](client, message as any);
        } catch (err) {
          console.error(err);
        }
      } catch (err) {
        console.error(err);
        clientContext.with(client, () => leave());
      } finally {
        flushUpdates();
      }
    }),
  );

  socket.addEventListener("close", wrap(client, () => leave()));
};
