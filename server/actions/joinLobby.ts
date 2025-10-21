import { z } from "zod";
import type { Client } from "../client.ts";
import { lobbies } from "../lobby.ts";
import { broadcastLobbyList, leaveHub } from "../hub.ts";
import { lobbyContext } from "../contexts.ts";
import { send } from "../lobbyApi.ts";
import { colors } from "@/shared/data.ts";
import { setSome } from "../util/set.ts";
import { addPlayerToPracticeGame } from "../api/player.ts";
import { appContext } from "@/shared/context.ts";
import { flushUpdates } from "../updates.ts";
import { serializeLobbySettings } from "./lobbySettings.ts";

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

  // Remove from hub
  leaveHub(client);

  // Add to lobby
  client.lobby = lobby;
  lobbyContext.with(lobby, () => {
    lobby.settings.teams.set(client, "pending");
    client.color = colors.find((c) =>
      !setSome(lobby.players, (p) => p.color === c)
    ) ?? client.color;
    client.sheepCount = Math.max(
      ...Array.from(lobby.players, (p) => p.sheepCount),
    );
    send({
      type: "join",
      status: lobby.status,
      players: [{
        id: client.id,
        name: client.name,
        color: client.color,
        team: "pending",
        host: false,
        sheepCount: client.sheepCount,
      }],
      updates: [],
      lobbySettings: serializeLobbySettings(lobby, 1),
    });
    lobby.players.add(client);
    console.log(new Date(), "Client", client.id, "joined lobby", lobby.name);

    // Update lobby list for hub
    broadcastLobbyList();

    // Send full lobby state to joining client
    client.send({
      type: "join",
      status: lobby.status,
      players: Array.from(
        lobby.players,
        (p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          team: lobby.settings.teams.get(p) ?? "pending",
          local: p === client ? true : undefined,
          host: lobby.host === p,
          sheepCount: p.sheepCount,
        }),
      ),
      updates: Array.from(lobby.round?.ecs.entities ?? []),
      rounds: lobby.rounds,
      lobbySettings: serializeLobbySettings(lobby),
    });

    // If joining an ongoing practice game, add player to sheep team and spawn units
    if (lobby.round?.practice && lobby.round) {
      appContext.with(lobby.round.ecs, () => {
        appContext.current.batch(() => {
          addPlayerToPracticeGame(client);
        });
      });
    }

    flushUpdates();
  });
};
