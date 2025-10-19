import { Entity } from "@/shared/types.ts";
import { addSystem } from "@/shared/context.ts";
import { iterateBuffs } from "@/shared/api/unit.ts";

addSystem((app) => ({
  props: ["buffs"],
  updateEntity: (entity, delta) => {
    if (!entity.buffs || entity.buffs.length === 0) return;

    // Initialize healthRegen to 0 if any buff provides healthRegen and entity doesn't have it
    if (entity.healthRegen === undefined) {
      for (const buff of iterateBuffs(entity)) {
        if (buff.healthRegen) {
          entity.healthRegen = 0;
          break;
        }
      }
    }

    // Check if any buffs have remaining duration before updating
    const hasTimedBuffs = entity.buffs.some((buff) =>
      typeof buff.remainingDuration === "number"
    );

    // Check for expiring buffs before updating
    const expiringBuffs = entity.buffs.filter(
      (buff) =>
        buff.expiration && typeof buff.remainingDuration === "number" &&
        buff.remainingDuration - delta <= 0,
    );

    // Only update direct buffs if at least one has remaining duration
    if (hasTimedBuffs) {
      const updatedBuffs = entity.buffs
        .map((buff) => (typeof buff.remainingDuration === "number"
          ? {
            ...buff,
            remainingDuration: buff.remainingDuration - delta,
          }
          : buff)
        )
        .filter((buff) =>
          typeof buff.remainingDuration !== "number" ||
          buff.remainingDuration > 0
        );

      if (updatedBuffs.length === 0) (entity as Entity).buffs = null;
      else entity.buffs = updatedBuffs;
    }

    // Update item buffs
    if (entity.inventory) {
      // Check if any item buffs have remaining duration before updating
      const hasItemBuffsWithDuration = entity.inventory.some((item) =>
        item.buffs?.some((buff) => typeof buff.remainingDuration === "number")
      );

      // Only update inventory if at least one item buff had remaining duration
      if (hasItemBuffsWithDuration) {
        const updatedInventory = entity.inventory.map((item) => {
          if (!item.buffs) return item;

          const updatedItemBuffs = item.buffs
            .map((buff) => (typeof buff.remainingDuration === "number"
              ? {
                ...buff,
                remainingDuration: buff.remainingDuration - delta,
              }
              : buff)
            )
            .filter((buff) =>
              typeof buff.remainingDuration !== "number" ||
              buff.remainingDuration > 0
            );

          return {
            ...item,
            buffs: updatedItemBuffs.length > 0 ? updatedItemBuffs : undefined,
          };
        });

        entity.inventory = updatedInventory;
      }
    }

    // Handle expiration effects after updating buffs
    for (const buff of expiringBuffs) {
      if (buff.expiration) return app.enqueue(() => app.removeEntity(entity));
    }
  },
}));
