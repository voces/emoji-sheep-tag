import { z } from "zod";
import { getPlayers } from "@/shared/api/player.ts";
import { getTeamEntity } from "../api/teamGold.ts";
import { isPractice } from "../api/st.ts";
import type { Client } from "../client.ts";
import type { GameClient } from "../shard/gameClient.ts";

export const zResetGold = z.object({
  type: z.literal("resetGold"),
});

export const resetGold = (client: Client | GameClient) => {
  if (!client.lobby || !isPractice()) {
    console.error(
      `Client ${client.id} attempted to reset gold but not in practice mode`,
    );
    return;
  }

  // Check if client is host (works for both Client and GameClient)
  const isHost = "hostId" in client.lobby
    ? client.lobby.hostId === client.id
    : client.lobby.host?.id === client.id;

  if (!isHost) {
    console.error(
      `Client ${client.id} attempted to reset gold but is not the host`,
    );
    return;
  }

  // Reset all player gold
  for (const player of getPlayers()) {
    player.gold = 0;
  }

  // Reset team gold entities
  const sheepTeam = getTeamEntity("sheep");
  const wolfTeam = getTeamEntity("wolf");
  if (sheepTeam) sheepTeam.gold = 0;
  if (wolfTeam) wolfTeam.gold = 0;
};
