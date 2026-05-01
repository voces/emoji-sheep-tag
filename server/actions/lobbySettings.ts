import { z } from "zod";
import { Client } from "../client.ts";
import { send } from "../lobbyApi.ts";
import { Lobby } from "../lobby.ts";
import { LobbySettings } from "../../client/schemas.ts";
import {
  getMapManifestTags,
  getMapMeta,
  MAPS,
} from "@/shared/maps/manifest.ts";
import {
  getDefaultIncome,
  getDefaultStartingGold,
  getIdealSheep,
  getIdealTime,
} from "../st/roundHelpers.ts";
import { getShardInfoList, isValidShardId } from "../shardRegistry.ts";
import { notifyStatusChange } from "../statusStream.ts";
import { type LobbyMode, mapMatchesMode } from "@/shared/maps/tags.ts";
import { getCustomMapTags } from "./uploadCustomMap.ts";

// C->S
export const zLobbySettings = z.object({
  type: z.literal("lobbySettings"),
  map: z.string().refine((value) =>
    !!getMapMeta(value) || value.startsWith("local:")
  ).optional(),
  mode: z
    .union([
      z.literal("survival"),
      z.literal("vip"),
      z.literal("switch"),
      z.literal("vamp"),
      z.literal("bulldog"),
    ])
    .optional(),
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
  view: z.boolean().optional(),
  teamGold: z.boolean().optional(),
  shard: z.string().nullable().optional(),
  speedMultiplier: z.number().min(0).optional(),
});

// S->C
export const serializeLobbySettings = (
  lobby: Lobby,
  playerOffset = 0,
): LobbySettings => {
  // Count only non-observer, non-pending players (includes computers)
  const nonObserverCount =
    Array.from(lobby.players).filter((p) =>
      p.team !== "observer" && p.team !== "pending"
    ).length;
  const players = Math.max(nonObserverCount + playerOffset, 1);
  const idealSheep = getIdealSheep(players, lobby.settings.mode);
  const maxSheep = Math.max(players - 1, 1);
  const sheep = lobby.settings.sheep === "auto"
    ? idealSheep
    : Math.max(Math.min(lobby.settings.sheep, maxSheep), 1);
  return {
    map: lobby.settings.map,
    mode: lobby.settings.mode,
    vipHandicap: lobby.settings.vipHandicap,
    sheep,
    autoSheep: lobby.settings.sheep === "auto",
    time: lobby.settings.time === "auto"
      ? getIdealTime(players, sheep, lobby.settings.mode)
      : lobby.settings.time,
    autoTime: lobby.settings.time === "auto",
    startingGold: lobby.settings.startingGold,
    income: lobby.settings.income,
    view: lobby.settings.view,
    teamGold: lobby.settings.teamGold,
    editor: lobby.round?.editor,
    practice: lobby.round?.practice,
    host: lobby.host?.id ?? null,
    shard: lobby.settings.shard ?? null,
    shards: getShardInfoList(lobby),
    speedMultiplier: lobby.settings.speedMultiplier,
  };
};

const tagsForMap = (lobby: Lobby, mapId: string): readonly string[] => {
  if (mapId.startsWith("local:")) {
    return getCustomMapTags(lobby, mapId) ?? ["survival"];
  }
  const meta = getMapMeta(mapId);
  return meta ? getMapManifestTags(meta) : [];
};

const isMapValidForMode = (
  lobby: Lobby,
  mapId: string,
  mode: LobbyMode,
): boolean => mapMatchesMode(tagsForMap(lobby, mapId), mode);

const pickDefaultMapForMode = (mode: LobbyMode): string | undefined =>
  MAPS.find((m) => mapMatchesMode(getMapManifestTags(m), mode))?.id;

export const lobbySettings = (
  client: Client,
  {
    mode,
    vipHandicap,
    sheep,
    startingGold,
    time,
    income,
    map,
    view,
    teamGold,
    shard,
    speedMultiplier,
  }: z.TypeOf<typeof zLobbySettings>,
) => {
  const lobby = client.lobby;
  if (!lobby || lobby.host !== client) {
    console.warn("Non-host tried to change lobby settings", client.id);
    return;
  }

  // Update lobby settings
  if (mode !== undefined && mode !== lobby.settings.mode) {
    const oldMode = lobby.settings.mode;
    lobby.settings.mode = mode;
    if (!isMapValidForMode(lobby, lobby.settings.map, mode)) {
      const fallback = pickDefaultMapForMode(mode);
      if (fallback) lobby.settings.map = fallback;
    }
    // Roll over mode-scaled settings (gold, income) to the new mode's defaults
    // only if the host hasn't customized them — i.e. they still match the old
    // mode's default at the current player count. Manual tweaks survive.
    const players = Math.max(
      Array.from(lobby.players).filter((p) =>
        p.team !== "observer" && p.team !== "pending"
      ).length,
      1,
    );
    // auto-sheep is mode-dependent, so resolve separately per mode for the
    // comparison vs assignment.
    const resolveSheep = (m: typeof mode): number =>
      lobby.settings.sheep === "auto"
        ? getIdealSheep(players, m)
        : Math.max(Math.min(lobby.settings.sheep, players - 1), 1);
    const oldSheep = resolveSheep(oldMode);
    const oldWolves = Math.max(players - oldSheep, 1);
    const newSheep = resolveSheep(mode);
    const newWolves = Math.max(players - newSheep, 1);

    const oldGold = getDefaultStartingGold(oldMode, oldSheep, oldWolves);
    if (
      lobby.settings.startingGold.sheep === oldGold.sheep &&
      lobby.settings.startingGold.wolves === oldGold.wolves
    ) {
      lobby.settings.startingGold = getDefaultStartingGold(
        mode,
        newSheep,
        newWolves,
      );
    }

    const oldIncome = getDefaultIncome(oldMode, oldSheep, oldWolves);
    if (
      lobby.settings.income.sheep === oldIncome.sheep &&
      lobby.settings.income.wolves === oldIncome.wolves
    ) {
      lobby.settings.income = getDefaultIncome(mode, newSheep, newWolves);
    }
  }
  if (vipHandicap !== undefined) lobby.settings.vipHandicap = vipHandicap;
  if (sheep !== undefined) lobby.settings.sheep = sheep;
  if (startingGold !== undefined) lobby.settings.startingGold = startingGold;
  if (time !== undefined) lobby.settings.time = time;
  if (income !== undefined) lobby.settings.income = income;
  if (view !== undefined) lobby.settings.view = view;
  if (teamGold !== undefined) lobby.settings.teamGold = teamGold;
  if (map && (getMapMeta(map) || map.startsWith("local:"))) {
    if (isMapValidForMode(lobby, map, lobby.settings.mode)) {
      lobby.settings.map = map;
    }
  }
  if (shard !== undefined && (shard === null || isValidShardId(shard))) {
    lobby.settings.shard = shard ?? undefined;
    // Host explicitly chose a server, disable auto-select
    lobby.settings.shardAutoSelect = false;
    notifyStatusChange();
  }
  if (speedMultiplier !== undefined) {
    lobby.settings.speedMultiplier = speedMultiplier;
  }

  // Send updated settings to all players in the lobby
  send({ type: "lobbySettings", ...serializeLobbySettings(lobby) });
};
