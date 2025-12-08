import { z } from "zod";
import type { ServerToClientMessage } from "../../client/schemas.ts";
import type { ShardLobby } from "./shardLobby.ts";
import {
  handleMessage,
  type Socket,
  wrapWithContext,
} from "../util/socketHandler.ts";

// Game-specific actions only (no lobby management like generic/team changes)
import { build, zBuild } from "../actions/build.ts";
import { upgrade, zUpgrade } from "../actions/upgrade.ts";
import { unitOrder, zOrderEvent } from "../actions/unitOrder.ts";
import { ping, zPing } from "../actions/ping.ts";
import { mapPing, zMapPing } from "../actions/mapPing.ts";
import { chat, zChat } from "../actions/chat.ts";
import { purchase, zPurchase } from "../actions/purchase.ts";
import {
  updateSelection,
  zUpdateSelection,
} from "../actions/updateSelection.ts";

// Shard-specific cancel handler (ends round on shard)
const zCancel = z.object({ type: z.literal("cancel") });
const cancel = (client: GameClient) => {
  // Only host can cancel, and only during a round
  if (client.id !== client.lobby.hostId || !client.lobby.round) return;
  client.lobby.endRound(true); // true = canceled
};

export class GameClient {
  id: string;
  name: string;
  playerColor: string;
  isPlayer: true = true;
  team: "sheep" | "wolf" | "pending" | "observer";
  gold?: number;
  handicap?: number;
  sheepCount: number;
  // Note: socket and lobby are defined non-enumerable in constructor to prevent JSON serialization
  socket!: Socket;
  lobby!: ShardLobby;

  constructor(
    socket: Socket,
    lobby: ShardLobby,
    playerInfo: {
      id: string;
      name: string;
      playerColor: string;
      team: "sheep" | "wolf" | "pending" | "observer";
      sheepCount: number;
    },
  ) {
    // Make socket and lobby properties non-enumerable to prevent JSON serialization issues
    Object.defineProperty(this, "socket", {
      value: socket,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    Object.defineProperty(this, "lobby", {
      value: lobby,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    this.id = playerInfo.id;
    this.name = playerInfo.name;
    this.playerColor = playerInfo.playerColor;
    this.team = playerInfo.team;
    this.sheepCount = playerInfo.sheepCount;
  }

  send(message: ServerToClientMessage) {
    if (this.socket.readyState !== WebSocket.OPEN) return;
    try {
      this.socket.send(JSON.stringify(message));
    } catch (err) {
      console.error("[GameClient] Send error:", err);
    }
  }

  rawSend(message: string) {
    if (this.socket.readyState !== WebSocket.OPEN) return;
    try {
      this.socket.send(message);
    } catch (err) {
      console.error("[GameClient] rawSend error:", err);
      this.socket.close();
    }
  }
}

const zGameMessage = z.discriminatedUnion("type", [
  zBuild,
  zUpgrade,
  zOrderEvent,
  zPing,
  zMapPing,
  zChat,
  zCancel,
  zPurchase,
  zUpdateSelection,
]);

const gameActions = {
  build,
  upgrade,
  unitOrder,
  ping,
  mapPing,
  chat,
  cancel,
  purchase,
  updateSelection,
};

export const setupGameClientHandlers = (client: GameClient) => {
  const { socket } = client;

  socket.addEventListener(
    "message",
    wrapWithContext(client, (e: { data: unknown }) => {
      handleMessage(e, zGameMessage, gameActions, client);
    }),
  );

  socket.addEventListener(
    "close",
    wrapWithContext(client, () => {
      client.lobby.removeClient(client);
    }),
  );
};
