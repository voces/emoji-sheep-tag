import { addSystem } from "@/shared/context.ts";
import { Entity } from "@/shared/types.ts";

addSystem({
  props: ["actionCooldowns"],
  updateEntity: (entity, delta) => {
    if (!entity.actionCooldowns) return;

    let hasRemainingCooldowns = false;
    const updated: Record<string, number> = {};

    for (const [orderId, remaining] of Object.entries(entity.actionCooldowns)) {
      const newRemaining = remaining - delta;
      if (newRemaining > 0) {
        updated[orderId] = newRemaining;
        hasRemainingCooldowns = true;
      }
    }

    if (hasRemainingCooldowns) entity.actionCooldowns = updated;
    else (entity as Entity).actionCooldowns = null;
  },
});
