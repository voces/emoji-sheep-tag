import { addSystem, appContext } from "@/shared/context.ts";
import { iterateBuffs, testClassification } from "@/shared/api/unit.ts";
import { getEntitiesInRange } from "@/shared/systems/kd.ts";
import { Game } from "../ecs.ts";
import { TICK_RATE } from "@/shared/constants.ts";
import { damageEntity } from "../api/unit.ts";
import { Entity } from "@/shared/types.ts";
import { Classification } from "@/shared/data.ts";

const processedThisTick = new Set<Entity>();

const updateEntity = (entity: Entity) => {
  // Deduplicate - skip if already processed this tick
  if (!entity.position || processedThisTick.has(entity)) return;
  processedThisTick.add(entity);

  // Group buffs by radius and tick interval to batch damage
  type BuffGroup = {
    radius: number;
    totalDamage: number;
    targetsAllowed: ReadonlyArray<ReadonlyArray<Classification>>;
  };
  const buffGroups = new Map<string, BuffGroup>();

  for (const buff of iterateBuffs(entity)) {
    if (
      !buff.tickDamage ||
      !buff.tickInterval ||
      !buff.radius ||
      !buff.targetsAllowed
    ) continue;

    const ticksPerInterval = Math.max(
      1,
      Math.round(buff.tickInterval / TICK_RATE),
    );

    if ((appContext.current as Game).tick % ticksPerInterval !== 0) continue;

    // Group by radius and targetsAllowed
    const key = `${buff.radius}-${JSON.stringify(buff.targetsAllowed)}`;
    const existing = buffGroups.get(key);
    if (existing) {
      existing.totalDamage += buff.tickDamage;
    } else {
      buffGroups.set(key, {
        radius: buff.radius,
        totalDamage: buff.tickDamage,
        targetsAllowed: buff.targetsAllowed,
      });
    }
  }

  // Process each buff group once
  for (const group of buffGroups.values()) {
    const nearbyEntities = getEntitiesInRange(
      entity.position.x,
      entity.position.y,
      group.radius,
    );

    for (const target of nearbyEntities) {
      if (target.id === entity.id) continue;
      if (!target.health || target.health <= 0 || !target.position) continue;

      const shouldDamage = testClassification(
        entity,
        target,
        group.targetsAllowed,
      );
      if (!shouldDamage) continue;

      damageEntity(entity, target, group.totalDamage, false);
    }
  }
};

addSystem({
  props: ["buffs"],
  updateEntity: updateEntity,
  update: () => processedThisTick.clear(),
});

addSystem({
  props: ["inventory"],
  updateEntity: updateEntity,
});
