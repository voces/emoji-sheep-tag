import { send } from "../client.ts";
import { Entity } from "../ecs.ts";
import { selection } from "../systems/selection.ts";
import { UnitDataActionTarget } from "@/shared/types.ts";
import { findAction, hasAction } from "@/shared/util/actionLookup.ts";
import { CursorVariant, updateCursor } from "../graphics/cursor.ts";
import { newIndicator } from "../systems/indicators.ts";
import { playEntitySound, playSound, playSoundAt } from "../api/sound.ts";
import { pick } from "../util/pick.ts";
import { MouseButtonEvent } from "../mouse.ts";
import { getLocalPlayer } from "../api/player.ts";
import { isEnemy, testClassification } from "@/shared/api/unit.ts";
import { Classification } from "@/shared/data.ts";
import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";
import { canPlayerExecuteAction } from "../util/allyPermissions.ts";
import { distanceBetweenEntities } from "@/shared/pathing/math.ts";

let lastAckAttackTime = 0;

const playAckAttackSound = (entity: Entity, targetId: string | undefined) => {
  const now = performance.now();
  const currentTargetId = entity.order && "targetId" in entity.order
    ? entity.order.targetId
    : undefined;
  const sameTarget = currentTargetId === targetId;
  const throttle = sameTarget ? 3000 : 1500;

  if (now - lastAckAttackTime < throttle) return;

  lastAckAttackTime = now;
  playEntitySound(entity, "ackAttack", { volume: 0.5 });
};

let activeOrder:
  | { order: string; variant: CursorVariant; aoe?: number }
  | undefined;

export const queued = { state: false };

export const getActiveOrder = () => activeOrder;

export const setActiveOrder = (
  order: string,
  variant: CursorVariant,
  aoe?: number,
) => {
  activeOrder = { order, variant, aoe };
  updateCursor();
};

export const cancelOrder = (
  check?: (order: string | undefined, blueprint: string | undefined) => boolean,
) => {
  queued.state = false;
  if (check && !check(activeOrder?.order, undefined)) return;
  if (activeOrder) {
    activeOrder = undefined;
    updateCursor();
  }
};

export const handleSmartTarget = (e: MouseButtonEvent): boolean => {
  const target = e.intersects.first();
  const localPlayer = getLocalPlayer();
  if (!localPlayer) return false;

  // Check if clicking on the only selected unit
  const clickingOnlySelectedUnit = target && selection.size === 1 &&
    target.selected && selection.first()?.id === target.id;

  const orders: Array<readonly [Entity, UnitDataActionTarget]> = [];

  for (const entity of selection) {
    // Skip if entity is constructing and action doesn't allow it
    const isConstructing = typeof entity.progress === "number";

    const action = entity.actions?.filter((a): a is UnitDataActionTarget => {
      // Check if player can execute this action (includes trueOwner, owner, and ally permissions)
      if (!canPlayerExecuteAction(localPlayer.id, entity, a)) return false;

      if (isConstructing) {
        const canExecute = "canExecuteWhileConstructing" in a &&
          a.canExecuteWhileConstructing === true;
        if (!canExecute) return false;
      }
      return a.type === "target" &&
        (target
          ? testClassification(entity, target, a.targeting)
          : typeof a.aoe === "number");
    }).sort((a, b) => {
      const getSmartValue = (action: UnitDataActionTarget) => {
        if (!action.smart) return Infinity;
        return Object.entries(action.smart).reduce(
          (min, [classification, priority]) => {
            let test = false;
            if (target) {
              // With target: test classification against target
              // Skip "ground" classification when there's a target
              if (classification !== "ground") {
                test = testClassification(entity, target, [[
                  classification as Classification,
                ]]);
              } else {
                test = false;
              }
            } else {
              // Without target (ground click): only "ground" classification matches
              test = typeof action.aoe === "number" &&
                classification === "ground";
            }
            const currentValue = test ? priority : Infinity;
            return currentValue < min ? currentValue : min;
          },
          Infinity,
        );
      };
      return getSmartValue(a) - getSmartValue(b);
    })[0];

    if (action) orders.push([entity, action] as const);
  }

  // If no orders found and clicking on the only selected unit, retry as ground click
  if (!orders.length && clickingOnlySelectedUnit) {
    return handleSmartTarget({
      ...e,
      intersects: new ExtendedSet(),
    } as MouseButtonEvent);
  }

  if (!orders.length) return false;

  const groupedOrders = orders.reduce((groups, [unit, action]) => {
    if (!groups[action.order]) groups[action.order] = [];
    groups[action.order].push(unit);
    return groups;
  }, {} as Record<string, Entity[]>);

  let targetTarget = false;

  for (const order in groupedOrders) {
    const againstTarget = target && (order !== "move" || target.movementSpeed);
    if (againstTarget) targetTarget = true;

    send({
      type: "unitOrder",
      units: Array.from(groupedOrders[order], (e) => e.id),
      order,
      target: againstTarget ? target.id : e.world,
      queue: e.queue,
    });

    if (order === "attack") {
      const u = groupedOrders[order].find((e) => e.sounds?.ackAttack);
      if (u) playAckAttackSound(u, target?.id);
    }
  }

  newIndicator({
    x: targetTarget ? target?.position?.x ?? e.world.x : e.world.x,
    y: targetTarget ? target?.position?.y ?? e.world.y : e.world.y,
  }, {
    model: "gravity",
    color: target && (orders.some(([u, order]) =>
        order.order === "attack" || order.order === "attack-ground" ||
        isEnemy(u, target)
      ))
      ? "#dd3333"
      : undefined,
    scale: targetTarget && target?.radius ? target.radius * 4 : 1,
  });

  return true;
};

export type TargetOrderResult =
  | { success: true }
  | { success: false; reason: "invalid-target" | "out-of-range" };

export const handleTargetOrder = (e: MouseButtonEvent): TargetOrderResult => {
  if (!activeOrder) return { success: false, reason: "invalid-target" };

  const orderToExecute = activeOrder.order;
  const target = e.intersects.first();

  // For ground-targeted orders (AOE cursor), ignore entities entirely
  const isGroundOrder = !!activeOrder.aoe;

  // Track if any unit failed due to range (vs classification)
  let anyOutOfRange = false;

  const unitsWithTarget = isGroundOrder
    ? new ExtendedSet<Entity>()
    : selection.filter((entity) => {
      // Skip if entity is constructing
      const isConstructing = typeof entity.progress === "number";
      if (isConstructing) {
        const action = findAction(
          entity,
          (a) => a.type === "target" && a.order === orderToExecute,
        );
        if (action) {
          const canExecute = "canExecuteWhileConstructing" in action &&
            action.canExecuteWhileConstructing === true;
          if (!canExecute) return false;
        }
      }

      if (!target) return false;

      const action = findAction(
        entity,
        (a): a is UnitDataActionTarget =>
          a.type === "target" && a.order === orderToExecute &&
          testClassification(entity, target, a.targeting),
      );
      if (!action) return false;

      if (typeof entity.movementSpeed !== "number") {
        const range = action.range ?? 0;
        const distance = distanceBetweenEntities(entity, target);
        if (distance > range) {
          anyOutOfRange = true;
          return false;
        }
      }

      return true;
    });

  if (target && unitsWithTarget.size) {
    if (orderToExecute === "attack") {
      const u = unitsWithTarget.find((e) => !!e.sounds?.ackAttack?.length);
      if (u) playAckAttackSound(u, target.id);
    }
    send({
      type: "unitOrder",
      units: Array.from(unitsWithTarget, (e) => e.id),
      order: orderToExecute,
      target: target.id,
      queue: e.queue,
    });
  }

  const unitsWithoutTarget = selection.filter((entity) => {
    if (unitsWithTarget.has(entity)) return false;

    // Skip if entity is constructing
    const isConstructing = typeof entity.progress === "number";
    if (isConstructing) {
      const action = entity.actions?.find((a) =>
        a.type === "target" && a.order === orderToExecute
      );
      if (action) {
        const canExecute = "canExecuteWhileConstructing" in action &&
          action.canExecuteWhileConstructing === true;
        if (!canExecute) return false;
      }
    }

    return hasAction(
      entity,
      (a) =>
        a.type === "target" && a.order === orderToExecute &&
        typeof a.aoe === "number",
    );
  });

  if (unitsWithoutTarget.size) {
    if (orderToExecute === "attack") {
      const u = unitsWithoutTarget.find((e) => !!e.sounds?.ackAttack?.length);
      if (u) playAckAttackSound(u, undefined);
    }
    send({
      type: "unitOrder",
      units: Array.from(unitsWithoutTarget, (e) => e.id),
      order: orderToExecute,
      target: e.world,
      queue: e.queue,
    });
  }

  if (unitsWithTarget.size || unitsWithoutTarget.size) {
    newIndicator({
      x: unitsWithTarget.size ? target?.position?.x ?? e.world.x : e.world.x,
      y: unitsWithTarget.size ? target?.position?.y ?? e.world.y : e.world.y,
    }, {
      model: "gravity",
      color:
        orderToExecute === "attack" || orderToExecute === "attack-ground" ||
          (target && unitsWithTarget.some((u) => isEnemy(u, target)))
          ? "#dd3333"
          : undefined,
      scale: unitsWithTarget.size && target?.radius ? target.radius * 4 : 1,
    });

    if (!e.queue) cancelOrder();
    else queued.state = true;

    return { success: true };
  }

  return {
    success: false,
    reason: anyOutOfRange ? "out-of-range" : "invalid-target",
  };
};

export const playOrderSound = (x?: number, y?: number, volume = 0.1) => {
  const sound = pick("click1", "click2", "click3", "click4");
  if (x !== undefined && y !== undefined) playSoundAt(sound, x, y, volume);
  else playSound("ui", sound, { volume });
};
