import z from "npm:zod";
import { currentApp } from "../contexts.ts";
import { ColorChangeEvent } from "../ecs.ts";
import { Client } from "../client.ts";
import { send } from "../lobbyApi.ts";

export const zGenericEvent = z.object({
  type: z.literal("generic"),
  event: z.union([
    z.object({
      type: z.literal("colorChange"),
      color: z.string().regex(/^#[a-f0-9]{6}$/i, {
        message: "Invalid hex color format",
      }),
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
    try {
      currentApp().dispatchTypedEvent(
        "colorChange",
        new ColorChangeEvent(client.id, event.event.color),
      );
    } catch {}
  }
};
