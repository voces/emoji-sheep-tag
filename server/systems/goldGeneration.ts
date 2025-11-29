import { addSystem } from "@/shared/context.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { lobbyContext } from "../contexts.ts";
import { getSheep } from "./sheep.ts";
import { getDistanceMultiplier } from "@/shared/penAreas.ts";

addSystem({
  props: ["isPlayer"],
  updateEntity: (entity, delta) => {
    if (!entity.id) return;

    const team = getPlayer(entity.id)?.team;

    if (team !== "sheep" && team !== "wolf") return;

    // Sheep players only generate gold if they have a living sheep
    let distanceMultiplier = 1;
    if (team === "sheep") {
      const sheep = getSheep(entity.id);
      if (!sheep || !sheep.health || sheep.health <= 0) return;
      distanceMultiplier = getDistanceMultiplier(
        sheep.position?.x ?? 0,
        sheep.position?.y ?? 0,
      );
    }

    // Determine gold generation rate based on team
    const goldPerSecond = team === "sheep"
      ? lobbyContext.current.settings.income.sheep * distanceMultiplier
      : lobbyContext.current.settings.income.wolves * 2 / 3;

    // Increment gold continuously based on delta time
    entity.gold = (entity.gold ?? 0) + (goldPerSecond * delta);
  },
});
