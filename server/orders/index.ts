import { Entity, Order } from "@/shared/types.ts";
import { Point } from "@/shared/pathing/math.ts";
import { findActionByOrder } from "@/shared/util/actionLookup.ts";
import { OrderDefinition, OrderOverride } from "./types.ts";
import { applyOrderEffects, resolveOrderTarget } from "./effects.ts";

import { mirrorImageOrder } from "./mirrorImage.ts";
import { destroyLastFarmOrder } from "./destroyLastFarm.ts";
import { biteOrder } from "./bite.ts";
import { manaPotionOrder } from "./manaPotion.ts";
import { locateSheepOrder } from "./locateSheep.ts";
import { cancelUpgradeOrder } from "./cancelUpgrade.ts";
import { swapOrder } from "./swap.ts";
import { dodgeOrder } from "./dodge.ts";
import { giveToEnemyOrder } from "./giveToEnemy.ts";
import { reclaimFromEnemyOrder } from "./reclaimFromEnemy.ts";
import { hayTrapOrder } from "./hayTrap.ts";
import { beamOrder } from "./beam.ts";
import { translocateOrder } from "./translocate.ts";
import { editorRemoveEntity } from "./editorRemoveEntity.ts";
import {
  editorMoveEntityDown,
  editorMoveEntityLeft,
  editorMoveEntityRight,
  editorMoveEntityUp,
} from "./editorMoveEntity.ts";
import {
  attackGroundOrder,
  attackOrder,
  holdOrder,
  moveOrder,
  stopOrder,
} from "./core.ts";

const overrides = new Map<string, OrderOverride>();
const registerOverride = (id: string, override: OrderOverride) =>
  overrides.set(id, override);

/** Synthesizes the cast order from the action's target shape and cast duration. */
const genericOnIssue = (
  unit: Entity,
  orderId: string,
  target: Point | string | undefined,
  queue: boolean,
): "immediate" | "ordered" | "failed" => {
  const action = findActionByOrder(unit, orderId);
  if (!action) return "failed";

  const castDuration = "castDuration" in action ? action.castDuration ?? 0 : 0;
  const hasTarget = target !== undefined;

  if (!queue && !hasTarget && castDuration === 0) return "immediate";

  const order: Order = {
    type: "cast",
    orderId,
    remaining: castDuration,
    ...(typeof target === "string"
      ? { targetId: target }
      : target
      ? { target }
      : {}),
  };

  if (queue) unit.queue = [...unit.queue ?? [], order];
  else {
    delete unit.queue;
    unit.order = order;
  }

  return "ordered";
};

/** Applies the action's data-driven effects against the order's target. */
const genericOnCastComplete = (unit: Entity, orderId: string) => {
  const action = findActionByOrder(unit, orderId);
  const effects = action && "effects" in action ? action.effects : undefined;
  if (!effects?.length) return;
  applyOrderEffects(unit, resolveOrderTarget(unit), effects);
};

export const getOrder = (orderId: string): OrderDefinition => {
  const override = overrides.get(orderId);
  return {
    id: orderId,
    canExecute: override?.canExecute,
    onIssue: override?.onIssue ??
      ((unit, target, queue) => genericOnIssue(unit, orderId, target, queue)),
    onCastStart: override?.onCastStart,
    onCastComplete: override?.onCastComplete ??
      ((unit) => genericOnCastComplete(unit, orderId)),
  };
};

// Core control verbs (handled entirely in onIssue).
registerOverride("move", moveOrder);
registerOverride("attack", attackOrder);
registerOverride("attack-ground", attackGroundOrder);
registerOverride("stop", stopOrder);
registerOverride("hold", holdOrder);

// Custom orders: only the callbacks that resist a data-driven representation.
// Any omitted callback falls back to the generic, effect-driven implementation.
registerOverride("mirrorImage", mirrorImageOrder);
registerOverride("destroyLastFarm", destroyLastFarmOrder);
registerOverride("bite", biteOrder);
registerOverride("manaPotion", manaPotionOrder);
registerOverride("locateSheep", locateSheepOrder);
registerOverride("cancel-upgrade", cancelUpgradeOrder);
registerOverride("swap", swapOrder);
registerOverride("dodge", dodgeOrder);
registerOverride("giveToEnemy", giveToEnemyOrder);
registerOverride("reclaimFromEnemy", reclaimFromEnemyOrder);
registerOverride("hayTrap", hayTrapOrder);
registerOverride("beam", beamOrder);
registerOverride("translocate", translocateOrder);
registerOverride("editorRemoveEntity", editorRemoveEntity);
registerOverride("editorMoveEntityDown", editorMoveEntityDown);
registerOverride("editorMoveEntityLeft", editorMoveEntityLeft);
registerOverride("editorMoveEntityRight", editorMoveEntityRight);
registerOverride("editorMoveEntityUp", editorMoveEntityUp);
