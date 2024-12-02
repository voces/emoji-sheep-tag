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
export class Client {
  id: string;
  name: string;
  color: string;

  lobby?: Lobby;

  constructor(readonly socket: WebSocket) {
    this.color = colors[clientIndex % colors.length];
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

const zClientToServerMessage = z.union([
  zStart,
  zMove,
  zBuild,
  zAttack,
  zOrderEvent,
  zPing,
]);

export type ClientToServerMessage = z.TypeOf<typeof zClientToServerMessage>;

const actions = {
  start,
  move,
  build,
  attack,
  unitOrder,
  ping,
};

export const handleSocket = (socket: WebSocket) => {
  const client = new Client(socket);

  clientContext.with(client, () => {
    if (lobbies.size) {
      const result = lobbies.values().next();
      if (result.done) throw new Error("Expected lobby");
      const lobby = client.lobby = result.value;
      lobbyContext.with(client.lobby, () => {
        lobby.settings.teams.set(client, "pending");
        send({
          type: "join",
          status: lobby.status,
          players: [{
            id: client.id,
            name: client.name,
            color: client.color,
            team: "pending",
          }],
          updates: [],
        });
        lobby.players.add(client);
      });
    } else {
      const lobby = client.lobby = newLobby();
      lobbyContext.with(lobby, () => {
        lobby.players.add(client);
        lobby.host = client;
        console.log("Client made host", lobby.name, client.id);
      });
    }
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
    wrap(client, (e) => {
      try {
        const json = JSON.parse(e.data);
        // console.log("C->S", json);
        const message = zClientToServerMessage.parse(json);
        actions[message.type](client, message as any);
        flushUpdates();
      } catch (err) {
        console.error(err);
        clientContext.with(client, () => leave());
      }
    }),
  );

  socket.addEventListener("close", wrap(client, () => leave()));
};
