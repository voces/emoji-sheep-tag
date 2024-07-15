import { app } from "../ecs.ts";
import { getLocalPlayer } from "../ui/vars/players.ts";

// Auto select unit
app.addSystem({
  props: ["id", "unitType", "owner"],
  onAdd: (e) => {
    if (
      e.owner === getLocalPlayer()?.id &&
      (e.unitType === "sheep" || e.unitType === "wolf")
    ) {
      e.selected = true;
    }
  },
});

export const selection = app.addSystem({ props: ["selected"] }).entities;
