import { Buff, Entity } from "@/shared/types.ts";
import { addSystem } from "@/shared/context.ts";
import { iterateBuffs } from "@/shared/api/unit.ts";
import { addEntity, removeEntity } from "@/shared/api/entity.ts";

const isTimed = (buff: Buff) => typeof buff.remainingDuration === "number";

const tickBuffs = (buffs: ReadonlyArray<Buff>, delta: number) =>
  buffs
    .map((buff) =>
      typeof buff.remainingDuration === "number"
        ? { ...buff, remainingDuration: buff.remainingDuration - delta }
        : buff
    )
    .filter((buff) =>
      typeof buff.remainingDuration !== "number" || buff.remainingDuration > 0
    );

addSystem((app) => ({
  props: ["buffs"],
  updateEntity: (entity: Entity, delta: number) => {
    if (!entity.buffs?.length) return;

    // Initialize healthRegen to 0 if any buff provides healthRegen and entity doesn't have it
    if (entity.healthRegen === undefined) {
      for (const buff of iterateBuffs(entity)) {
        if (buff.healthRegen) {
          entity.healthRegen = 0;
          break;
        }
      }
    }

    const expiringBuffs = entity.buffs.filter(
      (buff) =>
        buff.expiration && typeof buff.remainingDuration === "number" &&
        buff.remainingDuration - delta <= 0,
    );

    if (entity.buffs.some(isTimed)) {
      const updatedBuffs = tickBuffs(entity.buffs, delta);
      entity.buffs = updatedBuffs.length ? updatedBuffs : null;
    }

    for (const buff of expiringBuffs) {
      if (buff.spawnPrefab && entity.position) {
        addEntity({
          prefab: buff.spawnPrefab,
          position: { x: entity.position.x, y: entity.position.y },
          facing: entity.facing,
          modelScale: entity.modelScale,
          // TODO: don't hardcode
          progress: 0.11,
          completionTime: 1.5,
        });
      }
      if (buff.expiration) return app.enqueue(() => removeEntity(entity));
    }
  },
}));

addSystem({
  props: ["inventory"],
  updateEntity: (entity, delta) => {
    if (!entity.inventory.some((item) => item.buffs?.some(isTimed))) return;

    entity.inventory = entity.inventory.map((item) => {
      if (!item.buffs) return item;
      const buffs = tickBuffs(item.buffs, delta);
      return { ...item, buffs: buffs.length ? buffs : undefined };
    });
  },
});
