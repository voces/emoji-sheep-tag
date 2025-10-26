import z from "zod";
import { Client, getAllClients } from "../client.ts";
import { send } from "../lobbyApi.ts";
import { generateUniqueName } from "../util/uniqueName.ts";
import { colors } from "../../shared/data.ts";

export const zGenericEvent = z.object({
  type: z.literal("generic"),
  event: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("colorChange"),
      color: z.string().regex(/^#[a-f0-9]{6}$/i, {
        message: "Invalid hex color format",
      }),
    }),
    z.object({
      type: z.literal("nameChange"),
      name: z.string().min(1),
    }),
    z.object({ type: z.literal("reserved") }),
  ]),
});

export const generic = (
  client: Client,
  event: z.TypeOf<typeof zGenericEvent>,
) => {
  if (event.event.type === "colorChange") {
    const requestedColor = event.event.color;

    // Check if color is in the allowed list
    if (!colors.includes(requestedColor)) {
      console.error(`Color ${requestedColor} is not in the allowed color list`);
      return;
    }

    // Check if color is already taken by another player in the same lobby
    if (client.lobby) {
      const colorTaken = Array.from(client.lobby.players).some(
        (p) => p.id !== client.id && p.color === requestedColor,
      );

      if (colorTaken) {
        console.error(
          `Color ${requestedColor} is already taken in lobby ${client.lobby.name}`,
        );
        return;
      }
    }

    client.color = requestedColor;
    send({ type: "colorChange", id: client.id, color: requestedColor });
  } else if (event.event.type === "nameChange") {
    const uniqueName = generateUniqueName(
      event.event.name,
      getAllClients(),
      client,
    );
    client.name = uniqueName;
    send({ type: "nameChange", id: client.id, name: uniqueName });
  }
};
