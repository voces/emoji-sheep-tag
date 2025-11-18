import z from "zod";
import { Client } from "../client.ts";
import { validatePackedMap } from "@/shared/map/validation.ts";
import { type PackedMap } from "@/shared/map.ts";
import type { Lobby } from "../lobby.ts";

const customMapsByLobby = new WeakMap<
  Lobby,
  Map<string, PackedMap>
>();

export const zUploadCustomMap = z.object({
  type: z.literal("uploadCustomMap"),
  mapId: z.string().refine((id) => id.startsWith("local:")),
  mapData: z.unknown(),
});

export const uploadCustomMap = (
  client: Client,
  { mapId, mapData }: z.TypeOf<typeof zUploadCustomMap>,
) => {
  const lobby = client.lobby;
  if (!lobby || lobby.host !== client) {
    console.warn("Non-host tried to upload custom map", client.id);
    return;
  }

  const validation = validatePackedMap(mapData);
  if (!validation.valid) {
    console.warn(
      "Invalid custom map uploaded by",
      client.id,
      validation.errors,
    );
    return;
  }

  let customMaps = customMapsByLobby.get(lobby);
  if (!customMaps) {
    customMaps = new Map();
    customMapsByLobby.set(lobby, customMaps);
  }

  customMaps.set(mapId, mapData as PackedMap);
  console.log(
    new Date(),
    "Custom map",
    mapId,
    "uploaded to lobby",
    lobby.name,
    "by",
    client.id,
  );
};

export const getCustomMapForLobby = (
  lobby: Lobby,
  mapId: string,
): PackedMap | undefined => {
  const customMaps = customMapsByLobby.get(lobby);
  return customMaps?.get(mapId);
};
