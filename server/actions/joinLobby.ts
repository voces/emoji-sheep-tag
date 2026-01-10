import { z } from "zod";
import type { Client } from "../client.ts";
import { broadcastLobbyList, leaveHub } from "../hub.ts";
import { lobbyContext } from "../contexts.ts";
import { lobbies } from "../lobby.ts";
import { send, sendJoinMessage } from "../lobbyApi.ts";
import { colors } from "@/shared/data.ts";
import { setSome } from "../util/set.ts";
import { addPlayerToPracticeGame } from "../api/player.ts";
import { appContext } from "@/shared/context.ts";
import { flushUpdates } from "../updates.ts";
import { serializeLobbySettings } from "./lobbySettings.ts";
import { autoAssignSheepOrWolf, initializePlayer } from "../st/roundHelpers.ts";
import { serializeCaptainsDraft } from "./captains.ts";
import {
  fetchClientGeoAndBroadcast,
  getShard,
  sendToShard,
} from "../shardRegistry.ts";
import { id as generateId } from "@/shared/util/id.ts";

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

    if (lobby.activeShard) {
      // Game is running on a shard - send player to shard
      const shard = getShard(lobby.activeShard);
      if (shard) {
        const token = generateId("token");
        sendToShard(shard, {
          type: "addPlayer",
          lobbyId: lobby.name,
          player: {
            id: client.id,
            name: client.name,
            playerColor: client.playerColor,
            team: "pending",
            token,
          },
        });
        client.send({
          type: "connectToShard",
          shardUrl: shard.publicUrl,
          token,
          lobbyId: lobby.name,
        });
      }
    } else if (lobby.round) {
      // If joining an ongoing practice game, add player to sheep team and spawn units
      if (lobby.round.practice) {
        appContext.with(lobby.round.ecs, () => {
          appContext.current.batch(() => {
            addPlayerToPracticeGame(client);
          });
        });
      } else {
        // Joining during a non-practice round - stay as pending (observer)
        lobby.round.ecs.addEntity(client);
      }
    } else {
      // No round in progress - assign to a team using auto logic
      client.team = autoAssignSheepOrWolf(lobby);
    }

    // When game is on shard, skip primary server messaging - shard handles it
    if (!lobby.activeShard) {
      // Send partial state to existing players (before adding new player to lobby)
      send({
        type: "join",
        lobby: lobby.name,
        status: lobby.status,
        updates: lobby.round ? flushUpdates(false) : [client],
        lobbySettings: serializeLobbySettings(lobby, 1),
        captainsDraft: serializeCaptainsDraft(lobby.captainsDraft),
      });
    }

    // Add player to lobby
    lobby.players.add(client);
    console.log(new Date(), "Client", client.id, "joined lobby", lobby.name);

    // Send full state to joining player
    if (!lobby.activeShard) sendJoinMessage(client);

    // Update lobby list for hub
    broadcastLobbyList();

    // Fetch geolocation for shard sorting (async, broadcasts when complete)
    fetchClientGeoAndBroadcast(client);
  });
};
