import { distanceBetweenPoints, Point } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";
import { orderMove } from "../api/unit.ts";
import { lookup } from "../systems/lookup.ts";
import { isPractice } from "../api/st.ts";
import { updatePathing } from "../systems/pathing.ts";

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

  if (isPractice() && unit.position) {
    const targetPosition = "x" in target ? target : target.position;
    if (
      targetPosition &&
      distanceBetweenPoints(unit.position, targetPosition) > 20
    ) {
      unit.position = { x: targetPosition.x, y: targetPosition.y };
      updatePathing(unit);
      return;
    }
  }

  orderMove(unit, target, queue);
};
