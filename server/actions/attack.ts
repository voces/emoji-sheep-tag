import { Point } from "../../shared/pathing/math.ts";
import { Entity } from "../../shared/types.ts";
import { orderAttack as orderAttack } from "../api/unit.ts";
import { lookup } from "../systems/lookup.ts";

export const handleAttack = (
  unit: Entity,
  orderTarget: string | Point | undefined,
) => {
  if (!unit.attack || !unit.position) return;

  // Interrupt
  delete unit.action;
  delete unit.queue;

  const target = typeof orderTarget === "string"
    ? lookup(orderTarget)
    : orderTarget;
  if (!target) return;

  if (!("id" in target)) {
    console.warn("attack-move not yet implemented");
    return;
  }

  orderAttack(unit, target);
};
