import z from "npm:zod";
import { Client, getAllClients } from "../client.ts";
import { send } from "../lobbyApi.ts";
import { generateUniqueName } from "../util/uniqueName.ts";

export const zGenericEvent = z.object({
  type: z.literal("generic"),
  event: z.union([
    z.object({
      type: z.literal("colorChange"),
      color: z.string().regex(/^#[a-f0-9]{6}$/i, {
        message: "Invalid hex color format",
      }),
    }),
    z.object({
      type: z.literal("nameChange"),
      name: z.string().min(1).max(20),
    }),
    z.object({ type: z.literal("reserved") }),
  ]),
});

export const generic = (
  client: Client,
  event: z.TypeOf<typeof zGenericEvent>,
) => {
  if (event.event.type === "colorChange") {
    client.color = event.event.color;
    send({ type: "colorChange", id: client.id, color: event.event.color });
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
