import { Entity } from "@/shared/types.ts";
import { lookup } from "../lookup.ts";
import { tweenAttack } from "./tweenAttack.ts";

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

  const target = lookup(e.order.targetId);

  if (!target || !target.position || target.health === 0) {
    if (e.swing) delete e.swing;
    delete e.order;
    return delta;
  }

  return tweenAttack(e, delta);
};
