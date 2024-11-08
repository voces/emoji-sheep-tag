import { z } from "npm:zod";
import { currentApp } from "../contexts.ts";
import { UnitEventEvent } from "../ecs.ts";
import { lookup } from "../systems/lookup.ts";
import { Client } from "../client.ts";

export const zUnitEvent = z.object({
  type: z.literal("unitEvent"),
  units: z.string().array(),
  event: z.string(),
});

export const unitEvent = (
  client: Client,
  { units, event: name }: z.TypeOf<typeof zUnitEvent>,
) => {
  const app = currentApp();
  for (const uId of units) {
    const u = lookup(uId);
    const event = new UnitEventEvent(u, client.id, name);
    app.dispatchTypedEvent("unitEvent", event);
  }
};
