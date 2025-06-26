import { z } from "npm:zod";
import { currentApp } from "../contexts.ts";
import { UnitOrderEvent } from "../ecs.ts";
import { lookup } from "../systems/lookup.ts";
import { Client } from "../client.ts";
import { UnknownEntity } from "../errors/UnknownEntity.ts";
import { zPoint } from "../../shared/zod.ts";

export const zOrderEvent = z.object({
  type: z.literal("unitOrder"),
  units: z.string().array(),
  order: z.string(),
  target: z.union([zPoint, z.string()]).optional(),
});

export const unitOrder = (
  client: Client,
  { units, order, target }: z.TypeOf<typeof zOrderEvent>,
) => {
  const app = currentApp();
  for (const uId of units) {
    const u = lookup(uId);
    if (!u) throw new UnknownEntity(uId);
    if (client.id !== u.owner) continue;
    const event = new UnitOrderEvent(u, client.id, order, target);
    app.dispatchTypedEvent("unitOrder", event);
  }
};
