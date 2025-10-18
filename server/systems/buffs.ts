import { Entity } from "@/shared/types.ts";
import { addSystem } from "@/shared/context.ts";

addSystem((app) => ({
  props: ["buffs"],
  updateEntity: (entity, delta) => {
    if (!entity.buffs || entity.buffs.length === 0) return;

    // Check for expiring buffs before updating
    const expiringBuffs = entity.buffs.filter(
      (buff) =>
        buff.expiration && typeof buff.remainingDuration === "number" &&
        buff.remainingDuration - delta <= 0,
    );

    const updatedBuffs = entity.buffs
      .map((buff) => (typeof buff.remainingDuration === "number"
        ? {
          ...buff,
          remainingDuration: buff.remainingDuration - delta,
        }
        : buff)
      )
      .filter((buff) =>
        typeof buff.remainingDuration !== "number" || buff.remainingDuration > 0
      );

    if (updatedBuffs.length === 0) (entity as Entity).buffs = null;
    else entity.buffs = updatedBuffs;

    // Handle expiration effects after updating buffs
    for (const buff of expiringBuffs) {
      if (buff.expiration) return app.enqueue(() => app.removeEntity(entity));
    }
  },
}));
