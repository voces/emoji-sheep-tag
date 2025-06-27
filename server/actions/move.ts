import { Point } from "../../shared/pathing/math.ts";
import { Entity } from "../../shared/types.ts";
import { orderMove } from "../api/unit.ts";
import { lookup } from "../systems/lookup.ts";

export const handleMove = (
  unit: Entity,
  orderTarget: string | Point | undefined,
) => {
  if (!unit.position || !orderTarget) return;

  // Interrupt
  delete unit.action;
  delete unit.queue;

  const target = typeof orderTarget === "string"
    ? lookup(orderTarget)
    : orderTarget;
  if (!target) return;

  orderMove(unit, target);
};
