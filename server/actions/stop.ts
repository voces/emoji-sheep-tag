import { z } from "zod";
import { endRound } from "../lobbyApi.ts";
import { Client } from "../client.ts";
import { undoDraft } from "../st/roundHelpers.ts";

export const zCancel = z.object({
  type: z.literal("cancel"),
});

export const cancel = (client: Client) => {
  if (client.lobby?.host !== client || !client.lobby.round) return;
  if (!client.lobby.round.practice && client.lobby.settings.mode !== "switch") {
    // Undo the draft selection (this restores all smart algorithm state)
    undoDraft();
    // Also decrement display sheepCount on clients
    for (const p of client.lobby.players) {
      if (p.team === "sheep") p.sheepCount--;
    }
  }
  endRound(true);
};
