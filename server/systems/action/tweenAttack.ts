import { distanceBetweenEntities } from "../../../shared/pathing/math.ts";
import { Entity } from "../../../shared/types.ts";
import { lookup } from "../lookup.ts";
import { calcPath } from "../pathing.ts";
import { tweenPath } from "./tweenPath.ts";
import { tweenSwing } from "./tweenSwing.ts";

export const tweenAttack = (e: Entity, delta: number) => {
  if (
    !e.position || !e.attack || !e.action || !("targetId" in e.action) ||
    !e.action.targetId
  ) return delta;

  const target = lookup(e.action.targetId);
  if (!target?.position) return delta;

  if (e.swing) return tweenSwing(e, delta);

  // Target too far, cancel attack and start walking
  if (distanceBetweenEntities(e, target) > e.attack.range) {
    const path = calcPath(e, target.id, { mode: "attack" }).slice(1);

    // If no longer pathable, give up
    if (
      !path.length ||
      (path.at(-1)?.x === e.position.x &&
        path.at(-1)?.y === e.position.y)
    ) {
      delete e.action;
      return delta;
    }

    e.action = { ...e.action, path };

    // Otherwise start walking!
    return tweenPath(e, delta);
  } else if (e.action.path) {
    const { path: _path, ...rest } = e.action;
    e.action = { ...rest };
  }

  if (!e.attackCooldownRemaining) {
    e.swing = {
      remaining: Math.max(e.attack.backswing, e.attack.damagePoint),
      source: e.position,
      target: target.position,
    };
    return delta;
  }

  return 0;
};
