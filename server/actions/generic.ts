import z from "zod";
import { Client, getAllClients } from "../client.ts";
import { send } from "../lobbyApi.ts";
import { generateUniqueName } from "../util/uniqueName.ts";
import { colors } from "@/shared/data.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { autoAssignSheepOrWolf, getIdealSheep } from "../st/roundHelpers.ts";
import { absurd } from "@/shared/util/absurd.ts";
import { serializeLobbySettings } from "./lobbySettings.ts";

export const zGenericEvent = z.object({
  type: z.literal("generic"),
  event: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("colorChange"),
      color: z.string().regex(/^#[a-f0-9]{6}$/i, {
        message: "Invalid hex color format",
      }),
      playerId: z.string().optional(),
    }),
    z.object({
      type: z.literal("nameChange"),
      name: z.string().min(1),
    }),
    z.object({
      type: z.literal("teamChange"),
      team: z.union([
        z.literal("sheep"),
        z.literal("wolf"),
        z.literal("observer"),
        z.literal("auto"),
      ]),
      playerId: z.string().optional(),
    }),
  ]),
});

type ColorChangeEvent = Extract<
  z.TypeOf<typeof zGenericEvent>["event"],
  { type: "colorChange" }
>;
type NameChangeEvent = Extract<
  z.TypeOf<typeof zGenericEvent>["event"],
  { type: "nameChange" }
>;
type TeamChangeEvent = Extract<
  z.TypeOf<typeof zGenericEvent>["event"],
  { type: "teamChange" }
>;

const updatePlayerProperty = (
  playerId: string,
  property: string,
  value: unknown,
) => {
  try {
    const p = getPlayer(playerId);
    if (!p) throw p;
    // deno-lint-ignore no-explicit-any
    (p as any)[property] = value;
  } catch {
    send({
      type: "updates",
      updates: [{ id: playerId, [property]: value }],
    });
  }
};

const handleColorChange = (client: Client, event: ColorChangeEvent) => {
  const requestedColor = event.color;
  const targetPlayerId = event.playerId ?? client.id;

  // If changing another player's color, verify client is the host
  if (targetPlayerId !== client.id) {
    if (!client.lobby || client.lobby.host?.id !== client.id) {
      console.error(
        `Client ${client.id} attempted to change color for ${targetPlayerId} but is not the host`,
      );
      return;
    }
  }

  // Check if color is in the allowed list
  if (!colors.includes(requestedColor)) {
    console.error(`Color ${requestedColor} is not in the allowed color list`);
    return;
  }

  // Check if color is already taken by another player in the same lobby
  if (client.lobby) {
    const colorTaken = Array.from(client.lobby.players).some(
      (p) => p.id !== targetPlayerId && p.playerColor === requestedColor,
    );

    if (colorTaken) {
      console.error(
        `Color ${requestedColor} is already taken in lobby ${client.lobby.name}`,
      );
      return;
    }
  }

  // Find the target client
  const targetClient = Array.from(client.lobby?.players ?? []).find((c) =>
    c.id === targetPlayerId
  );
  if (targetClient) {
    targetClient.playerColor = requestedColor;
  }

  updatePlayerProperty(targetPlayerId, "playerColor", requestedColor);
};

const handleNameChange = (client: Client, event: NameChangeEvent) => {
  const uniqueName = generateUniqueName(
    event.name,
    getAllClients(),
    client,
  );

  client.name = uniqueName;
  updatePlayerProperty(client.id, "name", uniqueName);
};

const handleTeamChange = (client: Client, event: TeamChangeEvent) => {
  if (!client.lobby) {
    console.error(
      `Client ${client.id} attempted to change team but is not in a lobby`,
    );
    return;
  }

  // Can't change teams during a round
  if (client.lobby.round) {
    console.error(
      `Client ${client.id} attempted to change team during an active round`,
    );
    return;
  }

  const targetPlayerId = event.playerId ?? client.id;
  const requestedTeam = event.team;

  // Permission checking
  const isHost = client.lobby.host?.id === client.id;
  const isSelf = targetPlayerId === client.id;

  if (!isSelf && !isHost) {
    console.error(
      `Client ${client.id} attempted to change team for ${targetPlayerId} but is not the host`,
    );
    return;
  }

  // Players can only set themselves to observer or auto, not specific teams
  if (
    isSelf && !isHost &&
    (requestedTeam === "sheep" || requestedTeam === "wolf")
  ) {
    console.error(
      `Client ${client.id} attempted to set their own team to ${requestedTeam} but only observer/auto are allowed`,
    );
    return;
  }

  // Find the target client
  const targetClient = Array.from(client.lobby.players).find((c) =>
    c.id === targetPlayerId
  );
  if (!targetClient) {
    console.error(`Target player ${targetPlayerId} not found in lobby`);
    return;
  }

  // Determine the actual team to assign
  const newTeam: "sheep" | "wolf" | "observer" = requestedTeam === "auto"
    ? autoAssignSheepOrWolf(client.lobby)
    : requestedTeam;

  // Update the team
  targetClient.team = newTeam;
  updatePlayerProperty(targetPlayerId, "team", newTeam);

  // Calculate current team state after the change
  const nonObserverCount =
    Array.from(client.lobby.players).filter((p) =>
      p.team !== "observer" && p.team !== "pending"
    ).length;
  const sheepCount =
    Array.from(client.lobby.players).filter((p) => p.team === "sheep").length;
  const idealSheep = getIdealSheep(nonObserverCount);
  const matchesIdeal = sheepCount === idealSheep;

  // Update sheep count setting based on whether result matches ideal
  if (matchesIdeal) {
    // Team composition matches ideal - enable auto mode
    client.lobby.settings.sheep = "auto";
  } else {
    // Doesn't match ideal - set to actual count (clamped to valid range)
    const maxSheep = Math.max(nonObserverCount - 1, 1);
    client.lobby.settings.sheep = Math.max(
      Math.min(sheepCount, maxSheep),
      1,
    );
  }

  // Broadcast updated lobby settings to reflect new non-observer count
  send({ type: "lobbySettings", ...serializeLobbySettings(client.lobby) });
};

export const generic = (
  client: Client,
  event: z.TypeOf<typeof zGenericEvent>,
) => {
  const eventData = event.event;
  switch (eventData.type) {
    case "colorChange":
      return handleColorChange(client, eventData);
    case "nameChange":
      return handleNameChange(client, eventData);
    case "teamChange":
      return handleTeamChange(client, eventData);
    default:
      absurd(eventData);
  }
};
