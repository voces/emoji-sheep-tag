import type { ServerToClientMessage } from "./schemas.ts";
import { zMessage } from "./schemas.ts";
import { handlers } from "./messageHandlers.ts";
import { stateVar } from "@/vars/state.ts";
import { unloadEcs } from "./ecs.ts";
import { generateDoodads } from "@/shared/map.ts";
import { addChatMessage } from "@/vars/chat.ts";

let shardSocket: WebSocket | undefined;
let intentionalDisconnect = false;

/**
 * Connect to a shard server for game traffic.
 * The primary server connection remains open for lobby operations.
 */
export const connectToShard = (
  shardUrl: string,
  token: string,
  lobbyId: string,
) => {
  // Close any existing shard connection
  disconnectFromShard();

  const url = new URL(shardUrl);
  url.searchParams.set("token", token);
  url.searchParams.set("lobby", lobbyId);

  shardSocket = new WebSocket(url.toString());

  shardSocket.addEventListener("message", (e) => {
    let data: ServerToClientMessage;
    try {
      data = zMessage.parse(JSON.parse(e.data));
    } catch (err) {
      console.error("Invalid message:", err);
      return;
    }

    // Route messages through the same handlers
    handlers[data.type](data as never);
  });

  shardSocket.addEventListener("close", () => {
    const wasPlaying = stateVar() === "playing";
    shardSocket = undefined;

    // If disconnected unexpectedly while playing, return to lobby
    if (wasPlaying && !intentionalDisconnect) {
      stateVar("lobby");
      unloadEcs();
      generateDoodads(["dynamic"]);
      addChatMessage("Connection to game server lost");
    }
    intentionalDisconnect = false;
  });

  shardSocket.addEventListener("error", (e) => {
    console.error("WebSocket error:", e);
  });
};

/**
 * Disconnect from the current shard.
 */
export const disconnectFromShard = () => {
  if (shardSocket) {
    intentionalDisconnect = true;
    shardSocket.close();
    shardSocket = undefined;
  }
};

/**
 * Get the current shard WebSocket if connected.
 */
export const getShardSocket = ():
  | { readyState: number; send: (data: string) => void }
  | undefined => shardSocket;
