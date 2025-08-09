import { Entity } from "@/shared/types.ts";
import { addSystem } from "../ecs.ts";

addSystem({
  props: ["buffs"],
  updateEntity: (entity, delta) => {
    if (!entity.buffs || entity.buffs.length === 0) return;

    const updatedBuffs = entity.buffs
      .map((buff) => ({
        ...buff,
        remainingDuration: buff.remainingDuration - delta,
      }))
      .filter((buff) => buff.remainingDuration > 0);

    if (updatedBuffs.length === 0) (entity as Entity).buffs = null;
    else entity.buffs = updatedBuffs;
  },
});
