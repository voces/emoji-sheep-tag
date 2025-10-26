import type { Client } from "./client.ts";
import { ServerToClientMessage } from "../client/client.ts";
import { lobbies } from "./lobby.ts";
import { colors } from "@/shared/data.ts";

// Set of clients in hub (lobby browser, not in any lobby)
export const hubClients = new Set<Client>();

/** Send a message to all clients in hub */
export const sendToHub = (message: ServerToClientMessage) => {
  const serialized = JSON.stringify(message);
  for (const client of hubClients) {
    client.rawSend(serialized);
  }
};

/** Get serialized lobby list */
export const serializeLobbyList = () =>
  Array.from(lobbies, (lobby) => ({
    name: lobby.name!,
    playerCount: lobby.players.size,
    status: lobby.status,
    isOpen: lobby.players.size < colors.length,
  })).sort((a, b) => b.playerCount - a.playerCount);

/** Send updated lobby list to all hub clients */
export const broadcastLobbyList = () => {
  sendToHub({
    type: "hubState",
    lobbies: serializeLobbyList(),
  });
};

/** Add client to hub */
export const joinHub = (client: Client) => {
  hubClients.add(client);
  // Initial state will be sent when socket opens (see client.ts "open" handler)
};

/** Remove client from hub */
export const leaveHub = (client: Client) => {
  hubClients.delete(client);
};
