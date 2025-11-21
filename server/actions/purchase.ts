import { z } from "zod";

import { Entity } from "@/shared/types.ts";
import { Client } from "../client.ts";
import { lookup } from "../systems/lookup.ts";
import { deductPlayerGold, getPlayerGold } from "../api/player.ts";
import { items } from "@/shared/data.ts";
import { addItem } from "../api/unit.ts";
import { canExecuteActionOnUnit } from "../util/allyPermissions.ts";
import { findAction } from "../util/actionLookup.ts";

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
  if (!canExecuteActionOnUnit(client, u, action)) return;

  // Find the item in the predefined items
  const item = items[itemId];
  if (!item) return;

  // Check if unit has enough gold
  if (!u.owner || getPlayerGold(u.owner) < item.gold) return;

  // Deduct gold from player
  deductPlayerGold(u.owner, item.gold);

  // Add item to inventory using the addItem API
  addItem(u, itemId);

  return u;
};
