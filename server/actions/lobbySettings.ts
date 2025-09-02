import { z } from "npm:zod";
import { Client } from "../client.ts";
import { send } from "../lobbyApi.ts";

export const zLobbySettings = z.object({
  type: z.literal("lobbySettings"),
  startingGold: z.object({
    sheep: z.number().min(0).max(100_000),
    wolves: z.number().min(0).max(100_000),
  }).optional(),
});

export const lobbySettings = (
  client: Client,
  { startingGold }: z.TypeOf<typeof zLobbySettings>,
) => {
  const lobby = client.lobby;
  if (!lobby || lobby.host !== client) {
    console.warn("Non-host tried to change lobby settings", client.id);
    return;
  }

  // Update lobby settings
  if (startingGold !== undefined) {
    lobby.settings.startingGold = startingGold;
  }

  // Send updated settings to all players in the lobby
  send({
    type: "lobbySettings",
    startingGold: lobby.settings.startingGold,
  });
};
