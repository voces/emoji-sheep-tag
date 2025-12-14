import { addSystem } from "@/shared/context.ts";
import { distanceBetweenPoints } from "@/shared/pathing/math.ts";
import { lookup } from "./lookup.ts";
import { applyAndConsumeBuffs, damageEntity } from "../api/unit.ts";
import { getEntitiesInRange } from "@/shared/systems/kd.ts";
import { isEnemy, testClassification } from "@/shared/api/unit.ts";
import { removeEntity } from "@/shared/api/entity.ts";

addSystem({
  props: ["projectile", "position"],
  updateEntity: (e, delta) => {
    if (!e.projectile || !e.position) return;

    const distance = distanceBetweenPoints(e.position, e.projectile.target);
    const movement = e.projectile.speed * delta;

    if (distance <= movement) {
      e.position = e.projectile.target;

      const attacker = lookup(e.projectile.attackerId);
      if (!attacker) return removeEntity(e);

      const entitiesInRange = getEntitiesInRange(
        e.projectile.target.x,
        e.projectile.target.y,
        e.projectile.splashRadius,
      );

      for (const entity of entitiesInRange) {
        if (
          isEnemy(attacker, entity) &&
          testClassification(e, entity, attacker.attack?.targetsAllowed) &&
          entity.position &&
          distanceBetweenPoints(entity.position, e.projectile.target) <=
            e.projectile.splashRadius
        ) {
          if (entity.health) damageEntity(attacker, entity);
          applyAndConsumeBuffs(e, entity);
        }
      }

      return removeEntity(e);
    }

    const dx = e.projectile.target.x - e.position.x;
    const dy = e.projectile.target.y - e.position.y;
    const ratio = movement / distance;

    e.position = {
      x: e.position.x + dx * ratio,
      y: e.position.y + dy * ratio,
    };
  },
});
