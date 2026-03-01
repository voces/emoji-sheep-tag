import { z } from "zod";

import { Entity } from "@/shared/types.ts";
import { Client } from "../client.ts";
import { lookup } from "../systems/lookup.ts";
import { orderPurchase } from "../api/unit.ts";
import { allowedToExecuteActionOnUnit } from "../util/allyPermissions.ts";
import { findAction } from "@/shared/util/actionLookup.ts";

export const zPurchase = z.object({
  type: z.literal("purchase"),
  unit: z.string(),
  itemId: z.string(),
  queue: z.boolean(), // Not yet implemented
});

export const purchase = (
  client: Client,
  { unit, itemId }: z.TypeOf<typeof zPurchase>,
): Entity | void => {
  const u = lookup(unit);
  if (!u || !u.position || !u.inventory) return;

  // Find the purchase action for this item (checks unit actions, inventory, menus)
  const action = findAction(
    u,
    (a) => a.type === "purchase" && a.itemId === itemId,
  );
  if (!action) return;

  // Check if client can execute this purchase action
  if (!allowedToExecuteActionOnUnit(client, u, action)) return;

  orderPurchase(u, itemId);

  return u;
};
