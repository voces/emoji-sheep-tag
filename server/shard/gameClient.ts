import { z } from "zod";
import type { ServerToClientMessage } from "../../client/schemas.ts";
import type { ShardLobby } from "./shardLobby.ts";
import {
  handleMessage,
  type Socket,
  wrapWithContext,
} from "../util/socketHandler.ts";

// Game-specific actions only (no lobby management like generic/team changes)
// Note: cancel is routed through primary server, not handled here
import { build, zBuild } from "../actions/build.ts";
import { upgrade, zUpgrade } from "../actions/upgrade.ts";
import { unitOrder, zOrderEvent } from "../actions/unitOrder.ts";
import { ping, zPing } from "../actions/ping.ts";
import { mapPing, zMapPing } from "../actions/mapPing.ts";
import { chat, zChat } from "../actions/chat.ts";
import { purchase, zPurchase } from "../actions/purchase.ts";
import { resetGold, zResetGold } from "../actions/resetGold.ts";
import {
  updateSelection,
  zUpdateSelection,
} from "../actions/updateSelection.ts";

export class GameClient {
  id: string;
  name: string;
  playerColor: string;
  isPlayer: true = true;
  team: "sheep" | "wolf" | "pending" | "observer";
  handicap?: number;
  /** Unused, but required for type compatibility with Client */
  sheepCount = 0;
  startLocation?: { x: number; y: number; map: string };
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
      startLocation?: { x: number; y: number; map: string };
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

    // Make startLocation non-enumerable to prevent JSON serialization to clients
    Object.defineProperty(this, "startLocation", {
      value: playerInfo.startLocation,
      writable: true,
      enumerable: false,
      configurable: true,
    });

    this.id = playerInfo.id;
    this.name = playerInfo.name;
    this.playerColor = playerInfo.playerColor;
    this.team = playerInfo.team;
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
  zPurchase,
  zResetGold,
  zUpdateSelection,
]);

const gameActions = {
  build,
  upgrade,
  unitOrder,
  ping,
  mapPing,
  chat,
  purchase,
  resetGold,
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
