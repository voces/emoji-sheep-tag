import { z } from "zod";
import { Client } from "../client.ts";
import { send } from "../lobbyApi.ts";
import { Lobby } from "../lobby.ts";
import { LobbySettings } from "../../client/schemas.ts";
import { getIdealSheep, getIdealTime } from "../st/roundHelpers.ts";

// C->S
export const zLobbySettings = z.object({
  type: z.literal("lobbySettings"),
  mode: z.union([z.literal("survival"), z.literal("vip")]).optional(),
  vipHandicap: z.number().min(0.01).max(10).transform((v) =>
    Math.round(v * 100) / 100
  ).optional(),
  sheep: z.union([
    z.number().transform((v) => Math.max(v, 1)),
    z.literal("auto"),
  ]).optional(),
  time: z.union([
    z.number().transform((v) => Math.min(Math.max(v, 1), 3599)),
    z.literal("auto"),
  ]).optional(),
  startingGold: z.object({
    sheep: z.number().min(0).max(100_000),
    wolves: z.number().min(0).max(100_000),
  }).optional(),
  income: z.object({
    sheep: z.number().min(0).max(100).transform((v) =>
      Math.round(v * 100) / 100
    ),
    wolves: z.number().min(0).max(100).transform((v) =>
      Math.round(v * 100) / 100
    ),
  }).optional(),
});

// S->C
export const serializeLobbySettings = (
  lobby: Lobby,
  playerOffset = 0,
): LobbySettings => {
  const players = lobby.players.size + playerOffset;
  const idealSheep = getIdealSheep(players);
  const sheep = lobby.settings.sheep === "auto"
    ? idealSheep
    : Math.max(Math.min(lobby.settings.sheep, Math.max(players - 1, 1)), 1);
  return {
    mode: lobby.settings.mode,
    vipHandicap: lobby.settings.vipHandicap,
    sheep,
    autoSheep: lobby.settings.sheep === "auto",
    time: lobby.settings.time === "auto"
      ? getIdealTime(players, sheep)
      : lobby.settings.time,
    autoTime: lobby.settings.time === "auto",
    startingGold: lobby.settings.startingGold,
    income: lobby.settings.income,
  };
};

export const lobbySettings = (
  client: Client,
  { mode, vipHandicap, sheep, startingGold, time, income }: z.TypeOf<
    typeof zLobbySettings
  >,
) => {
  const lobby = client.lobby;
  if (!lobby || lobby.host !== client) {
    console.warn("Non-host tried to change lobby settings", client.id);
    return;
  }

  // Update lobby settings
  if (mode !== undefined) lobby.settings.mode = mode;
  if (vipHandicap !== undefined) lobby.settings.vipHandicap = vipHandicap;
  if (sheep !== undefined) lobby.settings.sheep = sheep;
  if (startingGold !== undefined) lobby.settings.startingGold = startingGold;
  if (time !== undefined) lobby.settings.time = time;
  if (income !== undefined) lobby.settings.income = income;

  // Send updated settings to all players in the lobby
  send({ type: "lobbySettings", ...serializeLobbySettings(lobby) });
};
