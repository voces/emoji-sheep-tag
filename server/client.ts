import { z } from "zod";

import type { ServerToClientMessage } from "../client/client.ts";
import { lobbies, type Lobby, newLobby } from "./lobby.ts";
import type { Entity } from "@/shared/types.ts";
import { clientContext, lobbyContext } from "./contexts.ts";
import { leave } from "./lobbyApi.ts";
import { build, zBuild } from "./actions/build.ts";
import { start, zStart } from "./actions/start.ts";
import { colors } from "@/shared/data.ts";
import { unitOrder, zOrderEvent } from "./actions/unitOrder.ts";
import { flushUpdates } from "./updates.ts";
import { ping, zPing } from "./actions/ping.ts";
import { mapPing, zMapPing } from "./actions/mapPing.ts";
import { generic, zGenericEvent } from "./actions/generic.ts";
import { chat, zChat } from "./actions/chat.ts";
import { cancel, zCancel } from "./actions/stop.ts";
import { purchase, zPurchase } from "./actions/purchase.ts";
import { lobbySettings, zLobbySettings } from "./actions/lobbySettings.ts";
import { appContext } from "@/shared/context.ts";
import { generateUniqueName } from "./util/uniqueName.ts";
import { getIdealSheep, getIdealTime } from "./st/roundHelpers.ts";
import { LobbySettings } from "../client/schemas.ts";
import {
  editorCreateEntity,
  editorSetPathing,
  editorUpdateEntities,
  zEditorCreateEntity,
  zEditorSetPathing,
  zEditorUpdateEntities,
} from "./actions/editor.ts";
import { joinLobby, zJoinLobby } from "./actions/joinLobby.ts";
import { createLobby, zCreateLobby } from "./actions/createLobby.ts";
import { joinHub, leaveHub, serializeLobbyList } from "./hub.ts";
import { upgrade, zUpgrade } from "./actions/upgrade.ts";

export type SocketEventMap = {
  close: unknown;
  error: unknown;
  message: { data: unknown };
  open: unknown;
};

export type Socket = {
  readyState: number;
  send: (data: string) => void;
  close: () => void;
  addEventListener: <K extends keyof SocketEventMap>(
    type: K,
    listener: (this: Socket, ev: SocketEventMap[K]) => void,
  ) => void;
};

// deno-lint-ignore no-explicit-any
const wrap = <T extends (...args: any[]) => unknown>(
  client: Client,
  fn: (...args: Parameters<T>) => ReturnType<T>,
) =>
(...args: Parameters<T>) => {
  if (client.lobby) {
    if (client.lobby.round) {
      return appContext.with(client.lobby.round.ecs, () =>
        lobbyContext.with(
          client.lobby!,
          () => clientContext.with(client, () => fn(...args)),
        ));
    }
    return lobbyContext.with(
      client.lobby!,
      () => clientContext.with(client, () => fn(...args)),
    );
  }
  return clientContext.with(client, () => fn(...args));
};

let clientIndex = 0;

const allClients = new Set<Client>();
export const getAllClients = () => allClients;

export class Client {
  id: string;
  name: string;
  color: string;

  lobby?: Lobby;
  playerEntity?: Entity;

  sheepCount = 0;

  constructor(readonly socket: Socket, providedName?: string) {
    this.color = colors[0];
    this.id = `player-${clientIndex++}`;
    this.name = providedName || `Player ${clientIndex}`;

    // Make name unique server-wide
    this.name = generateUniqueName(this.name, allClients, this);

    // Add to global client tracking
    allClients.add(this);
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
// type ClientInstance = InstanceType<typeof Client>;
// export type { ClientInstance as Client };

const zClientToServerMessage = z.discriminatedUnion("type", [
  zStart,
  zBuild,
  zUpgrade,
  zOrderEvent,
  zPing,
  zMapPing,
  zGenericEvent,
  zChat,
  zCancel,
  zPurchase,
  zLobbySettings,
  zEditorCreateEntity,
  zEditorUpdateEntities,
  zEditorSetPathing,
  zJoinLobby,
  zCreateLobby,
]);

export type ClientToServerMessage = z.TypeOf<typeof zClientToServerMessage>;

const actions = {
  start,
  build,
  upgrade,
  unitOrder,
  ping,
  mapPing,
  generic,
  chat,
  cancel,
  purchase,
  lobbySettings,
  editorCreateEntity,
  editorUpdateEntities,
  editorSetPathing,
  joinLobby,
  createLobby,
};

const serializeLobbySettings = (
  lobby: Lobby,
  playerOffset = 0,
): LobbySettings => {
  const players = lobby.players.size + playerOffset;
  const idealSheep = getIdealSheep(players);
  const sheep = lobby.settings.sheep === "auto"
    ? idealSheep
    : Math.min(Math.max(lobby.settings.sheep, 1), Math.max(players - 1, 1));
  return {
    sheep,
    autoSheep: lobby.settings.sheep === "auto",
    time: lobby.settings.time === "auto"
      ? getIdealTime(players, sheep)
      : lobby.settings.time,
    autoTime: lobby.settings.time === "auto",
    startingGold: lobby.settings.startingGold,
    income: lobby.settings.income,
  };
};

export const handleSocket = (socket: Socket, url?: URL) => {
  const client = new Client(socket, url?.searchParams.get("name") || undefined);
  console.log(new Date(), "Client", client.id, "connected");

  // If no lobbies exist, create one and add client to it
  if (lobbies.size === 0) {
    const lobby = newLobby(client);
    client.lobby = lobby;
    // Otherwise, add client to hub (lobby browser)
  } else joinHub(client);

  socket.addEventListener(
    "open",
    wrap(client, () => {
      if (client.lobby) {
        // Auto-joined a lobby
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
              sheepCount: p.sheepCount,
            }),
          ),
          updates: Array.from(client.lobby.round?.ecs.entities ?? []),
          rounds: client.lobby.rounds,
          lobbySettings: serializeLobbySettings(client.lobby),
        });
      } else {
        // Client in hub - send initial lobby list
        client.send({
          type: "hubState",
          lobbies: serializeLobbyList(),
        });
      }
    }),
  );

  socket.addEventListener(
    "message",
    wrap<(e: SocketEventMap["message"]) => void>(client, (e) => {
      let batch = (fn: () => void) => fn();
      try {
        batch = appContext.current.batch;
      } catch { /* do nothing */ }
      try {
        batch(() => {
          try {
            if (typeof e.data !== "string") {
              throw new Error("Expected data to be a string");
            }
            const json = JSON.parse(e.data);
            // console.log("C->S", json);
            const message = zClientToServerMessage.parse(json);
            try {
              // deno-lint-ignore no-explicit-any
              actions[message.type](client, message as any);
            } catch (err) {
              console.error(err);
            }
          } catch (err) {
            console.error(err);
            clientContext.with(client, () => leave());
          }
        });
      } finally {
        flushUpdates();
      }
    }),
  );

  socket.addEventListener(
    "close",
    wrap(client, () => {
      let batch = (fn: () => void) => fn();
      try {
        batch = appContext.current.batch;
      } catch { /* do nothing */ }

      try {
        if (client.lobby) batch(leave);
        // Client was in hub
        else leaveHub(client);
        allClients.delete(client);
      } finally {
        flushUpdates();
      }
    }),
  );
};
