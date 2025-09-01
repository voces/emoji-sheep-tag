import { send } from "../client.ts";
import { Entity } from "../ecs.ts";
import { selection } from "../systems/autoSelect.ts";
import { UnitDataActionTarget } from "@/shared/types.ts";
import { hasAction } from "../util/actionLookup.ts";
import { CursorVariant, updateCursor } from "../graphics/cursor.ts";
import { newIndicator } from "../systems/indicators.ts";
import { playEntitySound, playSound, playSoundAt } from "../api/sound.ts";
import { pick } from "../util/pick.ts";
import { MouseButtonEvent } from "../mouse.ts";
import { getLocalPlayer } from "@/vars/players.ts";
import { isEnemy, testClassification } from "@/shared/api/unit.ts";
import { Classification } from "@/shared/data.ts";

let activeOrder:
  | { order: string; variant: CursorVariant; aoe: number }
  | undefined;

export const getActiveOrder = () => activeOrder;

export const setActiveOrder = (
  order: string,
  variant: CursorVariant,
  aoe: number,
) => {
  activeOrder = { order, variant, aoe };
  updateCursor();
};

export const cancelOrder = (
  check?: (order: string | undefined, blueprint: string | undefined) => boolean,
) => {
  if (check && !check(activeOrder?.order, undefined)) return;
  if (activeOrder) {
    activeOrder = undefined;
    updateCursor();
  }
};

export const handleSmartTarget = (e: MouseButtonEvent) => {
  const target = e.intersects.first();
  const localPlayer = getLocalPlayer();
  const selections = selection.clone().filter((s) =>
    s.owner === localPlayer?.id
  );

  const orders: Array<readonly [Entity, UnitDataActionTarget]> = [];

  for (const entity of selections) {
    const actions = entity.actions?.filter((a): a is UnitDataActionTarget =>
      a.type === "target" &&
      (target
        ? testClassification(entity, target, a.targeting)
        : typeof a.aoe === "number")
    ).sort((a, b) => {
      const getSmartValue = (action: UnitDataActionTarget) => {
        if (!action.smart) return Infinity;
        return Object.entries(action.smart).reduce(
          (min, [classification, priority]) => {
            let test = false;
            if (target) {
              // With target: test classification against target
              // Skip "ground" classification when there's a target
              if (classification !== "ground") {
                test = testClassification(entity, target, [
                  classification as Classification,
                ]);
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

    if (actions) orders.push([entity, actions] as const);
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
      order: order,
      target: againstTarget ? target.id : e.world,
    });
  }

  newIndicator({
    x: targetTarget ? target?.position?.x ?? e.world.x : e.world.x,
    y: targetTarget ? target?.position?.y ?? e.world.y : e.world.y,
  }, {
    model: "gravity",
    color: target && orders.some(([u]) => isEnemy(u, target))
      ? "#dd3333"
      : undefined,
    scale: targetTarget && target?.radius ? target.radius * 4 : 1,
  });

  cancelOrder();

  return true;
};

export const handleTargetOrder = (e: MouseButtonEvent) => {
  if (!activeOrder) return false;

  const orderToExecute = activeOrder.order;
  const target = e.intersects.first();
  const unitsWithTarget = selection.filter((entity) =>
    hasAction(
      entity,
      (a) =>
        a.type === "target" && a.order === orderToExecute &&
        !!target && testClassification(entity, target, a.targeting),
    )
  );

  if (target && unitsWithTarget.size) {
    if (orderToExecute === "attack") {
      playEntitySound(
        unitsWithTarget.find((e) => !!e.sounds?.ackAttack?.length) ??
          { id: "unknown" },
        "ackAttack",
      );
    }
    send({
      type: "unitOrder",
      units: Array.from(unitsWithTarget, (e) => e.id),
      order: orderToExecute,
      target: target.id,
    });
  }

  const unitsWithoutTarget = selection.filter((entity) =>
    !unitsWithTarget.has(entity) &&
    hasAction(
      entity,
      (a) =>
        a.type === "target" && a.order === orderToExecute &&
        typeof a.aoe === "number",
    )
  );

  if (unitsWithoutTarget.size) {
    if (orderToExecute === "attack") {
      playEntitySound(
        unitsWithoutTarget.find((e) => !!e.sounds?.ackAttack?.length) ??
          { id: "unknown" },
        "ackAttack",
      );
    }
    send({
      type: "unitOrder",
      units: Array.from(unitsWithoutTarget, (e) => e.id),
      order: orderToExecute,
      target: e.world,
    });
  }

  if (unitsWithTarget.size || unitsWithoutTarget.size) {
    newIndicator({
      x: unitsWithTarget.size ? target?.position?.x ?? e.world.x : e.world.x,
      y: unitsWithTarget.size ? target?.position?.y ?? e.world.y : e.world.y,
    }, {
      model: "gravity",
      color: target && unitsWithTarget.some((u) => isEnemy(u, target))
        ? "#dd3333"
        : undefined,
      scale: unitsWithTarget.size && target?.radius ? target.radius * 4 : 1,
    });

    cancelOrder();
    return true;
  }

  return false;
};

export const playOrderSound = (x?: number, y?: number, volume = 0.1) => {
  const sound = pick("click1", "click2", "click3", "click4");
  if (x !== undefined && y !== undefined) playSoundAt(sound, x, y, volume);
  else playSound("ui", sound, { volume });
};
