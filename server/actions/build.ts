import { z } from "npm:zod";

import { Entity } from "@/shared/types.ts";
import { orderBuild } from "../api/unit.ts";
import { Client } from "../client.ts";
import { lobbyContext } from "../contexts.ts";
import { lookup } from "../systems/lookup.ts";

export const zBuild = z.object({
  type: z.literal("build"),
  unit: z.string(),
  buildType: z.string(), // literal
  x: z.number(),
  y: z.number(),
  queue: z.boolean().optional(),
});

export const build = (
  client: Client,
  { unit, buildType, x, y, queue }: z.TypeOf<typeof zBuild>,
): Entity | void => {
  const round = lobbyContext.current.round;
  if (!round) return;
  const u = lookup(unit);
  if (u?.owner !== client.id) return;

  // Interrupt if not queuing
  if (!queue) {
    delete u.order;
    delete u.queue;
  }

  orderBuild(u, buildType, x, y, queue);
};
