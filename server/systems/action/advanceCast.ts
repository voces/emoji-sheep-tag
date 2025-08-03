import { Entity } from "../../../shared/types.ts";
import { absurd } from "../../../shared/util/absurd.ts";
import { newUnit } from "../../api/unit.ts";
import { updatePathing } from "../pathing.ts";

export const advanceCast = (e: Entity, delta: number) => {
  if (e.order?.type !== "cast") return delta;

  if (delta < e.order.remaining) {
    e.order = { ...e.order, remaining: e.order.remaining - delta };
    return 0;
  }

  delta -= e.order.remaining;

  switch (e.order.info.type) {
    case "mirrorImage":
      e.position = e.order.info.positions[0];
      updatePathing(e);

      if (e.prefab && e.owner) {
        const mirrors: string[] = [];
        for (const pos of e.order.info.positions.slice(1)) {
          const mirror = newUnit(e.owner, e.prefab, pos.x, pos.y);
          mirror.actions = mirror.actions.filter((a) =>
            a.type !== "auto" || a.order !== "mirrorImage"
          );
          updatePathing(mirror);
          mirror.isMirror = true;

          // Copy health and mana from original unit
          if (e.health !== undefined) mirror.health = e.health;
          if (e.mana !== undefined) mirror.mana = e.mana;

          mirrors.push(mirror.id);
        }
        e.mirrors = mirrors;
      }
      break;
    default:
      absurd(e.order.info.type);
  }

  delete e.order;

  return delta;
};
