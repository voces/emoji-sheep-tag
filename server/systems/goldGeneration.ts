import { addSystem } from "@/shared/context.ts";
import { getPlayerTeam } from "@/shared/api/player.ts";

addSystem({
  props: ["isPlayer", "owner"],
  updateEntity: (entity, delta) => {
    if (!entity.owner) return;

    const team = getPlayerTeam(entity.owner);

    if (team !== "sheep" && team !== "wolf") return;

    // Determine gold generation rate based on team
    const goldPerSecond = team === "sheep" ? 1 : (1 / 1.5); // Sheep: 1/second, Wolf: 1/1.5 seconds

    // Increment gold continuously based on delta time
    entity.gold = (entity.gold ?? 0) + (goldPerSecond * delta);
  },
});
