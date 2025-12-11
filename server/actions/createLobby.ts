import { z } from "zod";
import type { Client } from "../client.ts";
import { newLobby } from "../lobby.ts";
import { leaveHub } from "../hub.ts";
import { lobbyContext } from "../contexts.ts";
import { sendJoinMessage } from "../lobbyApi.ts";
import { fetchClientGeoAndBroadcast } from "../shardRegistry.ts";

export const zCreateLobby = z.object({
  type: z.literal("createLobby"),
});

export const createLobby = (
  client: Client,
  _message: z.TypeOf<typeof zCreateLobby>,
) => {
  // Remove from hub
  leaveHub(client);

  // Create new lobby with client as host
  const lobby = newLobby(client);
  client.lobby = lobby;

  console.log(
    new Date(),
    "Client",
    client.id,
    "created lobby",
    lobby.name,
  );

  // Send full lobby state to client
  lobbyContext.with(lobby, () => sendJoinMessage(client));

  // Fetch geolocation for shard sorting (async, broadcasts when complete)
  fetchClientGeoAndBroadcast(client);
};
