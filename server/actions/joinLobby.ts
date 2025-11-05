import { z } from "zod";
import type { Client } from "../client.ts";
import { lobbies } from "../lobby.ts";
import { broadcastLobbyList, leaveHub } from "../hub.ts";
import { lobbyContext } from "../contexts.ts";
import { send, sendJoinMessage } from "../lobbyApi.ts";
import { colors } from "@/shared/data.ts";
import { setSome } from "../util/set.ts";
import { addPlayerToPracticeGame } from "../api/player.ts";
import { appContext } from "@/shared/context.ts";
import { flushUpdates } from "../updates.ts";
import { serializeLobbySettings } from "./lobbySettings.ts";
import { initializePlayer } from "../st/roundHelpers.ts";

export const zJoinLobby = z.object({
  type: z.literal("joinLobby"),
  lobbyName: z.string(),
});

export const joinLobby = (
  client: Client,
  { lobbyName }: z.TypeOf<typeof zJoinLobby>,
) => {
  // Find the lobby
  const lobby = Array.from(lobbies).find((l) => l.name === lobbyName);
  if (!lobby) {
    console.error(`Lobby ${lobbyName} not found`);
    return;
  }

  // Check if lobby is full (limited by available colors)
  if (lobby.players.size >= colors.length) {
    console.error(
      `Lobby ${lobbyName} is full (${colors.length}/${colors.length} players)`,
    );
    return;
  }

  // Remove from hub
  leaveHub(client);

  // Add to lobby
  client.lobby = lobby;
  lobbyContext.with(lobby, () => {
    client.playerColor = colors.find((c) =>
      !setSome(lobby.players, (p) => p.playerColor === c)
    ) ?? client.playerColor;

    // Initialize the player in the smart drafting algorithm
    const allPlayerIds = Array.from(lobby.players, (p) => p.id);
    initializePlayer(client.id, allPlayerIds);

    // Set display sheepCount to match others
    client.sheepCount = Math.max(
      ...Array.from(lobby.players, (p) => p.sheepCount),
    );

    if (lobby.round) {
      // If joining an ongoing practice game, add player to sheep team and spawn units
      if (lobby.round.practice) {
        client.team = "sheep";
        lobby.round.ecs.addEntity(client);

        appContext.with(lobby.round.ecs, () => {
          appContext.current.batch(() => {
            addPlayerToPracticeGame(client);
          });
        });
      } else lobby.round.ecs.addEntity(client);
    }

    // Send partial state to existing players (before adding joiner to lobby.players)
    send({
      type: "join",
      status: lobby.status,
      updates: lobby.round ? flushUpdates(false) : [client],
      lobbySettings: serializeLobbySettings(lobby, 1),
    });

    // Add player to lobby
    lobby.players.add(client);
    console.log(new Date(), "Client", client.id, "joined lobby", lobby.name);

    // Send full state to joining player
    sendJoinMessage(client);

    // Update lobby list for hub
    broadcastLobbyList();
  });
};
