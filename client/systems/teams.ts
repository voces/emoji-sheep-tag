import { app } from "../ecs.ts";
import { data } from "../data.ts";
import { playersVar } from "../ui/vars/players.ts";
import { visibilityGrid } from "./fog.ts";

// System to track team assignments by watching player entity team changes
app.addSystem({
  props: ["isPlayer", "owner", "team"],
  onChange: () => {
    // When a player entity's team changes, rebuild the team arrays
    const players = playersVar();
    data.sheep = players.filter((p) => p.entity?.team === "sheep");
    data.wolves = players.filter((p) => p.entity?.team === "wolf");

    // Force fog of war recalculation for ALL entities with vision
    // We need to check all entities because:
    // 1. Previously allied entities might no longer be allies
    // 2. Previously enemy entities might now be allies
    app.batch(() => {
      // Remove all currently tracked entities
      for (const entity of visibilityGrid.getVisionProvidingEntities()) {
        visibilityGrid.removeEntity(entity);
      }

      // Recalculate for all entities with sightRadius
      for (const entity of app.entities) {
        if (entity.position && entity.sightRadius) {
          visibilityGrid.updateEntity(entity);
        }
      }
    });
  },
});
