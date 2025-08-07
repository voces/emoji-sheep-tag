import { z } from "npm:zod";

import { Entity } from "../../shared/types.ts";
import { Client } from "../client.ts";
import { lookup } from "../systems/lookup.ts";
import { deductPlayerGold, getPlayerGold } from "../api/player.ts";
import { items } from "../../shared/data.ts";
import { addItem } from "../api/unit.ts";

export const zPurchase = z.object({
  type: z.literal("purchase"),
  unit: z.string(),
  itemId: z.string(),
});

export const purchase = (
  client: Client,
  { unit, itemId }: z.TypeOf<typeof zPurchase>,
): Entity | void => {
  const u = lookup(unit);
  if (u?.owner !== client.id) return;
  if (!u.position || !u.inventory) return;

  // Find the item in the predefined items
  const item = items[itemId];
  if (!item) return;

  // Check if unit has enough gold
  if (!u.owner || getPlayerGold(u.owner) < item.gold) return;

  // Deduct gold from player
  deductPlayerGold(u.owner, item.gold);

  // Add item to inventory using the addItem API
  addItem(u, itemId);

  // Apply item effects (for now just damage bonus)
  if (item.damage && u.attack) {
    u.attack = {
      ...u.attack,
      damage: u.attack.damage + item.damage,
    };
  }

  return u;
};
