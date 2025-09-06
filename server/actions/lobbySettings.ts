import { z } from "npm:zod";
import { Client } from "../client.ts";
import { send } from "../lobbyApi.ts";
import { Lobby } from "../lobby.ts";
import { LobbySettings } from "../../client/schemas.ts";
import { getIdealSheep, getIdealTime } from "../st/roundHelpers.ts";

// C->S
export const zLobbySettings = z.object({
  type: z.literal("lobbySettings"),
  time: z.union([
    z.number().transform((v) => Math.min(Math.max(v, 1), 3599)),
    z.literal("auto"),
  ]).optional(),
  startingGold: z.object({
    sheep: z.number().min(0).max(100_000),
    wolves: z.number().min(0).max(100_000),
  }).optional(),
});

// S->C
export const serializeLobbySettings = (
  lobby: Lobby,
  playerOffset = 0,
): LobbySettings => {
  const players = lobby.players.size + playerOffset;
  const sheep = getIdealSheep(players);
  return {
    sheep,
    time: lobby.settings.time === "auto"
      ? getIdealTime(players, sheep)
      : lobby.settings.time,
    autoTime: lobby.settings.time === "auto",
    startingGold: lobby.settings.startingGold,
  };
};

export const lobbySettings = (
  client: Client,
  { startingGold, time }: z.TypeOf<typeof zLobbySettings>,
) => {
  const lobby = client.lobby;
  if (!lobby || lobby.host !== client) {
    console.warn("Non-host tried to change lobby settings", client.id);
    return;
  }

  // Update lobby settings
  if (startingGold !== undefined) lobby.settings.startingGold = startingGold;
  if (time !== undefined) lobby.settings.time = time;

  // Send updated settings to all players in the lobby
  send({ type: "lobbySettings", ...serializeLobbySettings(lobby) });
};
