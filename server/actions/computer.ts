import { z } from "zod";
import type { Client } from "../client.ts";
import { ComputerPlayer, isComputerPlayer } from "../computerPlayer.ts";
import { send } from "../lobbyApi.ts";
import { colors } from "@/shared/data.ts";
import { autoAssignSheepOrWolf } from "../st/roundHelpers.ts";
import { serializeLobbySettings } from "./lobbySettings.ts";

export const zComputerEvent = z.object({
  type: z.literal("computer"),
  event: z.discriminatedUnion("type", [
    z.object({ type: z.literal("add") }),
    z.object({ type: z.literal("remove"), computerId: z.string() }),
  ]),
});

const handleAddComputer = (client: Client) => {
  const lobby = client.lobby;
  if (!lobby) {
    console.error(
      `Client ${client.id} attempted to add computer but is not in a lobby`,
    );
    return;
  }

  // Only host can add computers
  if (lobby.host?.id !== client.id) {
    console.error(
      `Client ${client.id} attempted to add computer but is not the host`,
    );
    return;
  }

  // Can't add computers during a round
  if (lobby.round) {
    console.error(
      `Client ${client.id} attempted to add computer during an active round`,
    );
    return;
  }

  // Check if lobby is full
  if (lobby.players.size >= colors.length) {
    console.error(
      `Lobby ${lobby.name} is full (${lobby.players.size}/${colors.length} participants)`,
    );
    return;
  }

  // Create computer player
  const computer = new ComputerPlayer(lobby);
  computer.team = autoAssignSheepOrWolf(lobby, 1);

  // Set sheepCount to match other players
  const maxSheepCount = Math.max(
    0,
    ...Array.from(lobby.players, (p) => p.sheepCount),
  );
  computer.sheepCount = maxSheepCount;

  // Add to lobby players set
  lobby.players.add(computer);

  console.log(
    new Date(),
    "Computer",
    computer.id,
    "added to lobby",
    lobby.name,
  );

  // Broadcast the new computer to all players
  send({
    type: "updates",
    updates: [computer],
  });

  // Update lobby settings to reflect new participant count
  send({ type: "lobbySettings", ...serializeLobbySettings(lobby) });
};

const handleRemoveComputer = (
  client: Client,
  event: { type: "remove"; computerId: string },
) => {
  const lobby = client.lobby;
  if (!lobby) {
    console.error(
      `Client ${client.id} attempted to remove computer but is not in a lobby`,
    );
    return;
  }

  // Only host can remove computers
  if (lobby.host?.id !== client.id) {
    console.error(
      `Client ${client.id} attempted to remove computer but is not the host`,
    );
    return;
  }

  // Can't remove computers during a round
  if (lobby.round) {
    console.error(
      `Client ${client.id} attempted to remove computer during an active round`,
    );
    return;
  }

  // Find the computer in the players set
  const computer = Array.from(lobby.players).find((p) =>
    p.id === event.computerId && isComputerPlayer(p)
  );

  if (!computer) {
    console.error(
      `Computer ${event.computerId} not found in lobby ${lobby.name}`,
    );
    return;
  }

  lobby.players.delete(computer);

  console.log(
    new Date(),
    "Computer",
    computer.id,
    "removed from lobby",
    lobby.name,
  );

  // Broadcast the deletion to all players
  send({
    type: "updates",
    updates: [{ id: computer.id, __delete: true }],
  });

  // Update lobby settings to reflect new participant count
  send({ type: "lobbySettings", ...serializeLobbySettings(lobby) });
};

export const computer = (
  client: Client,
  event: z.TypeOf<typeof zComputerEvent>,
) => {
  const eventData = event.event;
  switch (eventData.type) {
    case "add":
      return handleAddComputer(client);
    case "remove":
      return handleRemoveComputer(client, eventData);
  }
};
