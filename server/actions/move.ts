import { Point } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";
import { orderMove } from "../api/unit.ts";
import { lookup } from "../systems/lookup.ts";

export const handleMove = (
  unit: Entity,
  orderTarget: string | Point | undefined,
  queue = false,
) => {
  if (!unit.position || !orderTarget) return;

  // Interrupt only if not queuing
  if (!queue) {
    delete unit.order;
    delete unit.queue;
  }

  const target = typeof orderTarget === "string"
    ? lookup(orderTarget)
    : orderTarget;
  if (!target) return;

  orderMove(unit, target, queue);
};
