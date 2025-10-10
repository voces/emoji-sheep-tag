import { z } from "zod";
import type { Client } from "../client.ts";
import { newLobby } from "../lobby.ts";
import { leaveHub } from "../hub.ts";
import { lobbyContext } from "../contexts.ts";

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

  // Send lobby state to client
  lobbyContext.with(lobby, () => {
    client.send({
      type: "join",
      status: lobby.status,
      players: [{
        id: client.id,
        name: client.name,
        color: client.color,
        team: lobby.settings.teams.get(client) ?? "pending",
        local: true,
        host: true,
        sheepCount: client.sheepCount,
      }],
      updates: [],
      rounds: lobby.rounds,
      lobbySettings: {
        sheep: lobby.settings.sheep === "auto" ? 1 : lobby.settings.sheep,
        autoSheep: lobby.settings.sheep === "auto",
        time: lobby.settings.time === "auto" ? 60 : lobby.settings.time,
        autoTime: lobby.settings.time === "auto",
        startingGold: lobby.settings.startingGold,
        income: lobby.settings.income,
      },
    });
  });
};
