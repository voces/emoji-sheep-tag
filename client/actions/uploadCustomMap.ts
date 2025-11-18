import { send } from "../client.ts";
import { getLocalMap } from "../storage/localMaps.ts";

export const uploadAndSelectCustomMap = async (localMapId: string) => {
  const localMap = await getLocalMap(localMapId);
  if (!localMap) {
    throw new Error(`Custom map "${localMapId}" not found`);
  }

  const mapId = `local:${localMapId}`;

  send({
    type: "uploadCustomMap",
    mapId,
    mapData: localMap.data,
  });

  send({ type: "lobbySettings", map: mapId });
};
