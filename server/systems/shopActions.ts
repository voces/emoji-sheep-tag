import { SystemEntity } from "jsr:@verit/ecs";
import { Entity, UnitDataAction } from "../../shared/types.ts";
import { addSystem } from "../ecs.ts";
import { getEntitiesInRange } from "./kd.ts";
import { SHOP_INTERACTION_RANGE } from "../../shared/constants.ts";

// Cache to track which units have which shop actions to avoid unnecessary updates
const unitShopActionCache = new WeakMap<Entity, string[]>();

addSystem({
  props: ["inventory", "position"],
  updateEntity: (entity) => {
    if (entity.isMirror) return;

    // Find nearby shops
    const nearbyEntities = getEntitiesInRange(
      entity.position.x,
      entity.position.y,
      SHOP_INTERACTION_RANGE,
    );
    const nearbyShops = nearbyEntities.filter((
      e,
    ): e is SystemEntity<Entity, "position" | "items"> =>
      !!e.items && e.items.length > 0
    );

    // Generate action IDs for all available shop items
    const availableShopActionIds: string[] = [];
    const newPurchaseActions: UnitDataAction[] = [];

    for (const shop of nearbyShops) {
      for (const item of shop.items) {
        const actionId = `purchase-${shop.id}-${item.id}`;
        availableShopActionIds.push(actionId);

        // Create purchase action for this item
        const purchaseAction: UnitDataAction = {
          name: `Purchase ${item.name}`,
          type: "purchase",
          itemId: item.id,
          shopId: shop.id,
          binding: item.binding,
          goldCost: item.gold,
        };

        newPurchaseActions.push(purchaseAction);
      }
    }

    // Check if shop actions have changed
    const cachedActionIds = unitShopActionCache.get(entity) || [];
    const actionsChanged =
      cachedActionIds.length !== availableShopActionIds.length ||
      !cachedActionIds.every((id) => availableShopActionIds.includes(id));

    if (actionsChanged) {
      // Update cache
      unitShopActionCache.set(entity, availableShopActionIds);

      // Remove existing purchase actions from entity
      const baseActions = (entity.actions || []).filter(
        (action) => action.type !== "purchase",
      );

      // Add new purchase actions
      entity.actions = [...baseActions, ...newPurchaseActions];
    }
  },
});
