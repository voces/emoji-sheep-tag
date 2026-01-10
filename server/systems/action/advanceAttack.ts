import { Entity } from "@/shared/types.ts";
import { lookup } from "../lookup.ts";
import { tweenAttack } from "./tweenAttack.ts";
import { canSee } from "@/shared/api/unit.ts";

export const advanceAttack = (e: Entity, delta: number): number => {
  if (e.order?.type !== "attack" || !e.position) {
    if (e.swing) delete e.swing;
    return delta;
  }

  if (!e.attack) {
    if (e.swing) delete e.swing;
    delete e.order;
    return delta;
  }

  // Ground attack
  if ("target" in e.order && e.order.target) return tweenAttack(e, delta);

  // Entity attack
  if (!("targetId" in e.order)) {
    if (e.swing) delete e.swing;
    delete e.order;
    return delta;
  }

  const target = lookup(e.order.targetId);

  if (!target || !target.position || target.health === 0) {
    if (e.swing) delete e.swing;
    delete e.order;
    return delta;
  }

  // If target is no longer visible, convert to attack-move to last known position
  // (only if no queued orders)
  if (!canSee(e, target)) {
    if (e.swing) delete e.swing;
    if (e.queue?.length) delete e.order;
    else e.order = { type: "attackMove", target: { ...target.position } };
    return delta;
  }

  return tweenAttack(e, delta);
};
