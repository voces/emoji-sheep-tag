import { Point } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";
import { orderAttack } from "../api/unit.ts";
import { lookup } from "../systems/lookup.ts";

export const handleAttack = (
  unit: Entity,
  orderTarget: string | Point | undefined,
  queue = false,
  isGroundAttack = false,
) => {
  if (!unit.attack || !unit.position) return;

  const target = typeof orderTarget === "string"
    ? lookup(orderTarget)
    : orderTarget;
  if (!target) return;

  orderAttack(unit, target, queue, isGroundAttack);
};
