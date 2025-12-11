import { z } from "zod";

import type { ServerToClientMessage } from "../client/client.ts";
import { lobbies, type Lobby, newLobby } from "./lobby.ts";
import type { Entity } from "@/shared/types.ts";
import { clientContext, lobbyContext } from "./contexts.ts";
import { leave, sendJoinMessage } from "./lobbyApi.ts";
import { build, zBuild } from "./actions/build.ts";
import { start, zStart } from "./actions/start.ts";
import { colors } from "@/shared/data.ts";
import { unitOrder, zOrderEvent } from "./actions/unitOrder.ts";
import { ping, zPing } from "./actions/ping.ts";
import { mapPing, zMapPing } from "./actions/mapPing.ts";
import { generic, zGenericEvent } from "./actions/generic.ts";
import { chat, zChat } from "./actions/chat.ts";
import { cancel, zCancel } from "./actions/stop.ts";
import { purchase, zPurchase } from "./actions/purchase.ts";
import { lobbySettings, zLobbySettings } from "./actions/lobbySettings.ts";
import {
  uploadCustomMap,
  zUploadCustomMap,
} from "./actions/uploadCustomMap.ts";
import { generateUniqueName } from "./util/uniqueName.ts";
import {
  editorAdjustBounds,
  editorCreateEntity,
  editorResizeMap,
  editorSetCliff,
  editorSetPathing,
  editorUpdateEntities,
  zEditorAdjustBounds,
  zEditorCreateEntity,
  zEditorResizeMap,
  zEditorSetCliff,
  zEditorSetPathing,
  zEditorUpdateEntities,
} from "./actions/editor.ts";
import { joinLobby, zJoinLobby } from "./actions/joinLobby.ts";
import { createLobby, zCreateLobby } from "./actions/createLobby.ts";
import { joinHub, leaveHub, serializeLobbyList } from "./hub.ts";
import { fetchClientGeoAndBroadcast } from "./shardRegistry.ts";
import { upgrade, zUpgrade } from "./actions/upgrade.ts";
import {
  updateSelection,
  zUpdateSelection,
} from "./actions/updateSelection.ts";
import {
  cancelCaptains,
  captainPick,
  randomCaptains,
  reverseTeams,
  selectCaptain,
  startCaptains,
  zCancelCaptains,
  zCaptainPick,
  zRandomCaptains,
  zReverseTeams,
  zSelectCaptain,
  zStartCaptains,
} from "./actions/captains.ts";
import {
  handleMessage,
  type Socket,
  type SocketEventMap,
  wrapWithContext,
} from "./util/socketHandler.ts";

export type { Socket, SocketEventMap };

let clientIndex = 0;

const allClients = new Set<Client>();
export const getAllClients = () => allClients;

export class Client implements Entity {
  // Entity properties
  id: string;
  name: string;
  playerColor: string;
  isPlayer: true = true;
  team: "sheep" | "wolf" | "pending" | "observer" = "pending";
  gold?: number;
  handicap?: number;

  // Client-specific properties (not part of ECS)
  // Note: socket, lobby, ip are defined non-enumerable in constructor to prevent JSON serialization
  socket!: Socket;
  lobby?: Lobby;
  ip?: string; // Client's IP address for geolocation
  sheepCount = 0;

  constructor(socket: Socket, providedName?: string, ip?: string) {
    this.playerColor = colors[0];
    this.id = `player-${clientIndex++}`;
    this.name = providedName || `Player ${clientIndex}`;

    // Make name unique server-wide
    this.name = generateUniqueName(this.name, allClients, this);

    // Make socket, lobby, ip properties non-enumerable to prevent JSON serialization issues
    Object.defineProperty(this, "socket", {
      value: socket,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    Object.defineProperty(this, "lobby", {
      value: undefined,
      writable: true,
      enumerable: false,
      configurable: true,
    });

    Object.defineProperty(this, "ip", {
      value: ip,
      writable: false,
      enumerable: false,
      configurable: false,
    });

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
  zUploadCustomMap,
  zEditorCreateEntity,
  zEditorUpdateEntities,
  zEditorSetPathing,
  zEditorSetCliff,
  zEditorResizeMap,
  zEditorAdjustBounds,
  zJoinLobby,
  zCreateLobby,
  zUpdateSelection,
  zStartCaptains,
  zSelectCaptain,
  zRandomCaptains,
  zCaptainPick,
  zCancelCaptains,
  zReverseTeams,
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
  uploadCustomMap,
  editorCreateEntity,
  editorUpdateEntities,
  editorSetPathing,
  editorSetCliff,
  editorResizeMap,
  editorAdjustBounds,
  joinLobby,
  createLobby,
  updateSelection,
  startCaptains,
  selectCaptain,
  randomCaptains,
  captainPick,
  cancelCaptains,
  reverseTeams,
};

export const handleSocket = (socket: Socket, url?: URL, ip?: string) => {
  const client = new Client(
    socket,
    url?.searchParams.get("name") || undefined,
    ip,
  );
  console.log(new Date(), "Client", client.id, "connected");

  // If no lobbies exist, create one and add client to it
  if (lobbies.size === 0) {
    const lobby = newLobby(client);
    client.lobby = lobby;
    // Fetch geolocation for shard sorting (async, broadcasts when complete)
    fetchClientGeoAndBroadcast(client);
    // Otherwise, add client to hub (lobby browser)
  } else joinHub(client);

  socket.addEventListener(
    "open",
    wrapWithContext(client, () => {
      if (client.lobby) {
        // Auto-rejoin lobby - send full state
        lobbyContext.with(client.lobby, () => sendJoinMessage(client));
      } else {
        // Client in hub - send initial lobby list
        client.send({ type: "hubState", lobbies: serializeLobbyList() });
      }
    }),
  );

  socket.addEventListener(
    "message",
    wrapWithContext(client, (e: { data: unknown }) => {
      handleMessage(e, zClientToServerMessage, actions, client, () => {
        clientContext.with(client, () => leave());
      });
    }),
  );

  socket.addEventListener(
    "close",
    wrapWithContext(client, () => {
      if (client.lobby) leave();
      else leaveHub(client);
      allClients.delete(client);
    }),
  );
};
