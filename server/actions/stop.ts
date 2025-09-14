import { z } from "zod";
import { endRound } from "../lobbyApi.ts";
import { Client } from "../client.ts";

export const zCancel = z.object({
  type: z.literal("cancel"),
});

export const cancel = (client: Client) => {
  if (client.lobby?.host !== client || !client.lobby.round) return;
  if (!client.lobby.round.practice) {
    for (const sheep of client.lobby.round.sheep) sheep.sheepCount--;
  }
  endRound(true);
};
