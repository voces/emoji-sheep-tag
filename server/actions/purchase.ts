import { z } from "npm:zod";

import { Entity } from "../../shared/types.ts";
import { Client } from "../client.ts";
import { lookup } from "../systems/lookup.ts";
import { distanceBetweenEntities } from "../../shared/pathing/math.ts";
import { SHOP_INTERACTION_RANGE } from "../../shared/constants.ts";
import { deductPlayerGold, getPlayerGold } from "../api/player.ts";

export const zPurchase = z.object({
  type: z.literal("purchase"),
  unit: z.string(),
  itemId: z.string(),
  shopId: z.string(),
});

export const purchase = (
  client: Client,
  { unit, itemId, shopId }: z.TypeOf<typeof zPurchase>,
): Entity | void => {
  const u = lookup(unit);
  if (u?.owner !== client.id) return;
  if (!u.position || !u.inventory) return;

  const shop = lookup(shopId);
  if (
    !shop?.items || distanceBetweenEntities(u, shop) > SHOP_INTERACTION_RANGE
  ) return;

  if (!shop?.items) return;

  // Find the item in the shop
  const item = shop.items.find((i) => i.id === itemId);
  if (!item) return;

  // Check if unit has enough gold
  if (!u.owner || getPlayerGold(u.owner) < item.gold) return;

  // Deduct gold from player
  deductPlayerGold(u.owner, item.gold);

  // Add item to inventory
  u.inventory = [...u.inventory, item];

  // Apply item effects (for now just damage bonus)
  if (item.damage && u.attack) {
    u.attack = {
      ...u.attack,
      damage: u.attack.damage + item.damage,
    };
  }

  return u;
};
