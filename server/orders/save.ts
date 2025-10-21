import { Order } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { damageEntity, newUnit } from "../api/unit.ts";
import { lookup } from "../systems/lookup.ts";
import { findActionByOrder } from "../util/actionLookup.ts";
import { removeEntity } from "@/shared/api/entity.ts";
import { distanceBetweenEntities } from "@/shared/pathing/math.ts";
import { getSheepSpawn, getSpiritSpawn } from "../st/getSheepSpawn.ts";
import { isPractice } from "../api/st.ts";
import { getPlayer, grantPlayerGold } from "../api/player.ts";
import { newGoldText } from "../api/floatingText.ts";
import { send } from "../lobbyApi.ts";
import { colorName } from "@/shared/api/player.ts";
import { lobbyContext } from "../contexts.ts";

export const saveOrder = {
  id: "save",

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

    return "ordered";
  },

  onCastComplete: (unit) => {
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

    if (target.prefab === "spirit") {
      removeEntity(target);

      if (target.owner) {
        const spawn = isPractice()
          ? newUnit(target.owner, "spirit", ...getSpiritSpawn())
          : newUnit(
            target.owner,
            "sheep",
            ...(lobbyContext.current.settings.mode === "vip"
              ? [target.position?.x ?? 0, target.position?.y ?? 0] as [
                number,
                number,
              ]
              : getSheepSpawn()),
            lobbyContext.current.settings.mode === "vip"
              ? { facing: target.facing }
              : undefined,
          );

        grantPlayerGold(target.owner, 20);
        if (spawn.position) {
          newGoldText({ x: spawn.position.x, y: spawn.position.y + 0.5 }, 20);
        }
      }

      if (unit.owner) {
        grantPlayerGold(unit.owner, 100);
        if (unit.position) {
          newGoldText({ x: unit.position.x, y: unit.position.y + 0.5 }, 100);
        }

        // Send save message
        const savingPlayer = getPlayer(unit.owner);
        const savedPlayer = getPlayer(target.owner);

        if (savingPlayer && savedPlayer && !isPractice()) {
          send({
            type: "chat",
            message: `${
              colorName({
                color: savingPlayer.playerColor ?? "#ffffff",
                name: savingPlayer.name ?? "<unknown>",
              })
            } saved ${
              colorName({
                color: savedPlayer.playerColor ?? "#ffffff",
                name: savedPlayer.name ?? "<unknown>",
              })
            }`,
          });
        }
      }
    } else damageEntity(unit, target, 100);
  },
} satisfies OrderDefinition;
