import { Order } from "@/shared/types.ts";
import { findActionByOrder } from "../util/actionLookup.ts";
import { OrderDefinition } from "./types.ts";
import { getSheep } from "../systems/sheep.ts";
import { addEntity, removeEntity } from "@/shared/api/entity.ts";
import { timeout } from "../api/timing.ts";
import { getPlayer } from "@/shared/api/player.ts";

export const locateSheepOrder = {
  id: "locateSheep",

  onIssue: (unit, _, queue) => {
    const action = findActionByOrder(unit, "locateSheep");
    if (!action || action.type !== "auto") return "failed";

    const order: Order = {
      type: "cast",
      orderId: "locateSheep",
      remaining: action.castDuration ?? 0,
    };

    if (queue) {
      unit.queue = [...unit.queue ?? [], order];
      return "ordered";
    }

    return "immediate";
  },

  onCastComplete: (unit) => {
    const action = findActionByOrder(unit, "locateSheep");
    if (!action || action.type !== "auto") return false;

    // Get all sheep and ping their locations
    const sheep = getSheep();

    for (const sheepEntity of sheep) {
      if (!sheepEntity.position || !sheepEntity.owner) continue;

      const sheepPlayer = getPlayer(sheepEntity.owner);
      if (!sheepPlayer) continue;

      // Create a ping indicator at the sheep's location
      const pingEntity = addEntity({
        prefab: "indicator",
        model: "location",
        modelScale: 400,
        alpha: 0.25,
        isDoodad: true,
        teamScoped: true,
        owner: unit.owner,
        turnSpeed: 0.02,
        position: { x: sheepEntity.position.x, y: sheepEntity.position.y },
        playerColor: sheepPlayer.playerColor,
      });

      timeout(() => removeEntity(pingEntity), 10);
    }
  },
} satisfies OrderDefinition;
