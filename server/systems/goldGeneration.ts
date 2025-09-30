import { addSystem } from "@/shared/context.ts";
import { getPlayerTeam } from "@/shared/api/player.ts";
import { lobbyContext } from "../contexts.ts";

addSystem({
  props: ["isPlayer", "owner"],
  updateEntity: (entity, delta) => {
    if (!entity.owner) return;

    const team = getPlayerTeam(entity.owner);

    if (team !== "sheep" && team !== "wolf") return;

    // Determine gold generation rate based on team
    const goldPerSecond = team === "sheep"
      ? lobbyContext.current.settings.income.sheep
      : lobbyContext.current.settings.income.wolves * 2 / 3;

    // Increment gold continuously based on delta time
    entity.gold = (entity.gold ?? 0) + (goldPerSecond * delta);
  },
});
