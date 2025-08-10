import { Entity } from "@/shared/types.ts";
import { addSystem } from "../ecs.ts";

addSystem((game) => ({
  props: ["buffs"],
  updateEntity: (entity, delta) => {
    if (!entity.buffs || entity.buffs.length === 0) return;

    // Check for expiring buffs before updating
    const expiringBuffs = entity.buffs.filter(
      (buff) => buff.expiration && buff.remainingDuration - delta <= 0,
    );

    const updatedBuffs = entity.buffs
      .map((buff) => ({
        ...buff,
        remainingDuration: buff.remainingDuration - delta,
      }))
      .filter((buff) => buff.remainingDuration > 0);

    if (updatedBuffs.length === 0) (entity as Entity).buffs = null;
    else entity.buffs = updatedBuffs;

    // Handle expiration effects after updating buffs
    for (const buff of expiringBuffs) {
      if (buff.expiration === "Sound") {
        // Delete the entity when sound buff expires
        game.delete(entity);
        return; // Exit early since entity is deleted
      }
    }
  },
}));
