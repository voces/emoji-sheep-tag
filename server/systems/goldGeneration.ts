import { addSystem } from "@/shared/context.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { lobbyContext } from "../contexts.ts";
import { getSheep } from "./sheep.ts";
import { getDistanceMultiplier } from "@/shared/penAreas.ts";
import {
  grantTeamGold,
  isTeamGoldEnabled,
  SHEEP_INDIVIDUAL_GOLD_CAP,
} from "../api/teamGold.ts";

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

    const goldAmount = goldPerSecond * delta;

    // Handle team gold distribution
    if (isTeamGoldEnabled()) {
      if (team === "wolf") {
        // Wolves: all gold goes to team pool
        grantTeamGold("wolf", goldAmount);
      } else {
        // Sheep: fill individual up to cap, overflow to team
        const currentGold = entity.gold ?? 0;
        const roomInIndividual = Math.max(
          0,
          SHEEP_INDIVIDUAL_GOLD_CAP - currentGold,
        );
        const toIndividual = Math.min(goldAmount, roomInIndividual);
        const toTeam = goldAmount - toIndividual;

        if (toIndividual > 0) {
          entity.gold = currentGold + toIndividual;
        }
        if (toTeam > 0) {
          grantTeamGold("sheep", toTeam);
        }
      }
    } else {
      // Standard mode: all gold goes to individual
      entity.gold = (entity.gold ?? 0) + goldAmount;
    }
  },
});
