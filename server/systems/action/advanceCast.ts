import { Entity } from "@/shared/types.ts";
import { getOrder } from "../../orders/index.ts";
import {
  findActionAndItem,
  findActionByOrder,
} from "../../util/actionLookup.ts";
import { tweenPath } from "./tweenPath.ts";
import { distanceBetweenPoints } from "@/shared/pathing/math.ts";
import { calcPath } from "../pathing.ts";
import { consumeItem } from "../../api/unit.ts";
import { addEntity } from "@/shared/api/entity.ts";

export const advanceCast = (e: Entity, delta: number) => {
  if (e.order?.type !== "cast") return delta;

  const { action, item } = findActionAndItem(e, e.order.orderId) ?? {};

  // Handle movement for cast orders with target and range
  const range = action?.type === "target" ? action.range : undefined;
  if (range !== undefined && e.order.target) {
    if (!e.position) {
      delete e.order;
      return delta;
    }

    const dist = distanceBetweenPoints(e.position, e.order.target);
    if (dist > range) {
      // Out of range - need to move closer
      const path = calcPath(e, e.order.target, { distanceFromTarget: range });

      if (!path.length) {
        // Can't reach target, fail the order
        delete e.order;
        return delta;
      }
      e.order = { ...e.order, path };

      // Tween along the path
      delta = tweenPath(e, delta);

      return delta;
    }
  }

  if ("path" in e.order) {
    const { path: _path, ...rest } = e.order;
    e.order = { ...rest };
  }

  // Handle cast start side effects (only once when cast begins)
  if (!e.order.started) {
    const orderDef = getOrder(e.order.orderId);

    // Generic mana consumption for all orders
    const action = findActionByOrder(e, e.order.orderId);
    if (action && "manaCost" in action && action.manaCost) {
      const manaCost = action.manaCost;
      if (manaCost > 0 && e.mana) e.mana -= manaCost;
    }

    if (
      action && "soundOnCastStart" in action && action.soundOnCastStart &&
      e.position && e.owner
    ) {
      addEntity({
        id: `sound-${Date.now()}-${Math.random()}`,
        owner: e.owner,
        position: { x: e.position.x, y: e.position.y },
        sounds: { birth: [action.soundOnCastStart] },
        buffs: [{ remainingDuration: 0.1, expiration: "Sound" }],
      });
    }

    orderDef?.onCastStart?.(e);

    // Mark the order as started
    e.order = { ...e.order, started: true };
  }

  if (delta < e.order.remaining) {
    e.order = { ...e.order, remaining: e.order.remaining - delta };
    return 0;
  }

  delta -= e.order.remaining;

  getOrder(e.order.orderId)?.onCastComplete?.(e);
  if (item) consumeItem(e, item);

  delete e.order;

  return delta;
};
