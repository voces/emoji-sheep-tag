import { z } from "npm:zod";
import { endRound } from "../lobbyApi.ts";
import { Client } from "../client.ts";

export const zCancel = z.object({
  type: z.literal("cancel"),
});

export const cancel = (client: Client) => {
  if (client.lobby?.host !== client || !client.lobby.round) return;
  for (const sheep of client.lobby.round.sheep) sheep.sheepCount--;
  endRound();
};
