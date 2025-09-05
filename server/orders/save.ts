import { Entity, Order } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { newUnit } from "../api/unit.ts";
import { lookup } from "../systems/lookup.ts";
import { findActionByOrder } from "../util/actionLookup.ts";
import { removeEntity } from "@/shared/api/entity.ts";
import { distanceBetweenEntities } from "@/shared/pathing/math.ts";
import { getSheepSpawn, getSpiritSpawn } from "../st/getSheepSpawn.ts";
import { isPractice } from "../api/st.ts";
import { grantPlayerGold } from "../api/player.ts";

export const saveOrder = {
  id: "save",

  // Called when the order is initiated (sets up the order on the unit)
  onIssue: (unit, target, queue) => {
    if (typeof target !== "string") return "failed";

    const action = findActionByOrder(unit, "save");
    if (!action) return "failed";

    const order: Order = {
      type: "cast",
      orderId: "save",
      remaining: "castDuration" in action ? action.castDuration ?? 0 : 0,
      targetId: target,
    };

    if (queue) unit.queue = [...unit.queue ?? [], order];
    else {
      delete unit.queue;
      unit.order = order;
    }

    return "incomplete";
  },

  // Called when the cast completes (spawn units, create effects, etc)
  onCastComplete: (unit: Entity) => {
    if (unit.order?.type !== "cast") return;

    const target = unit.order.targetId
      ? lookup(unit.order.targetId)
      : undefined;
    if (!target) return;

    const action = findActionByOrder(unit, "save");
    if (action?.type !== "target") return;

    if (
      action.range !== undefined &&
      distanceBetweenEntities(unit, target) < action.range
    ) return false;

    removeEntity(target);

    if (target.owner) {
      if (isPractice()) newUnit(target.owner, "spirit", ...getSpiritSpawn());
      else newUnit(target.owner, "sheep", ...getSheepSpawn());

      grantPlayerGold(target.owner, 20);
    }

    if (unit.owner) grantPlayerGold(unit.owner, 100);
  },
} satisfies OrderDefinition;
