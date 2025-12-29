import { z } from "zod";
import { endRound } from "../lobbyApi.ts";
import { Client } from "../client.ts";
import { undoDraft } from "../st/roundHelpers.ts";
import { endShardRound, getShard, sendToShard } from "../shardRegistry.ts";

export const zCancel = z.object({
  type: z.literal("cancel"),
});

export const cancel = (client: Client) => {
  const lobby = client.lobby;
  if (!lobby || lobby.host !== client) return;

  // Shard game: end round on primary and notify shard
  if (lobby.activeShard && lobby.status === "playing") {
    const shard = getShard(lobby.activeShard);
    if (shard) sendToShard(shard, { type: "cancelLobby", lobbyId: lobby.name });
    endShardRound(lobby.name, { canceled: true });
    return;
  }

  // Local game: cancel directly
  if (!lobby.round) return;
  if (!lobby.round.practice && lobby.settings.mode !== "switch") {
    undoDraft();
  }
  endRound(true);
};
