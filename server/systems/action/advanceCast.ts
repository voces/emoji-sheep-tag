import { Entity } from "../../../shared/types.ts";
import { absurd } from "../../../shared/util/absurd.ts";
import { newUnit } from "../../api/unit.ts";
import { updatePathing } from "../pathing.ts";

export const advanceCast = (e: Entity, delta: number) => {
  if (e.action?.type !== "cast") return delta;

  if (delta < e.action.remaining) {
    e.action = { ...e.action, remaining: e.action.remaining - delta };
    return 0;
  }

  delta -= e.action.remaining;

  switch (e.action.info.type) {
    case "mirrorImage":
      e.position = e.action.info.positions[0];
      updatePathing(e);

      if (e.unitType && e.owner) {
        const mirrors: string[] = [];
        for (const pos of e.action.info.positions.slice(1)) {
          const mirror = newUnit(e.owner, e.unitType, pos.x, pos.y);
          mirror.actions = mirror.actions.filter((a) =>
            a.type !== "auto" || a.order !== "mirrorImage"
          );
          updatePathing(mirror);
          mirror.isMirror = true;
          mirrors.push(mirror.id);
        }
        e.mirrors = mirrors;
      }
      break;
    default:
      absurd(e.action.info.type);
  }

  delete e.action;

  return delta;
};
