import { z } from "zod";

import { Entity } from "@/shared/types.ts";
import { orderUpgrade } from "../api/unit.ts";
import { Client } from "../client.ts";
import { lookup } from "../systems/lookup.ts";
import { findActionAndItem } from "@/shared/util/actionLookup.ts";
import { canExecuteActionOnUnit } from "../util/allyPermissions.ts";

export const zUpgrade = z.object({
  type: z.literal("upgrade"),
  units: z.string().array(),
  prefab: z.string(),
  queue: z.boolean().optional(),
});

export const upgrade = (
  client: Client,
  { units, prefab, queue }: z.TypeOf<typeof zUpgrade>,
): Entity | void => {
  for (const uId of units) {
    const u = lookup(uId);
    if (!u) return;

    const result = findActionAndItem(u, prefab);
    if (!result) return;

    const { action } = result;

    if (!canExecuteActionOnUnit(client, u, action)) return;

    if (!queue) {
      delete u.order;
      delete u.queue;
    }

    orderUpgrade(u, prefab, queue);
  }
};
