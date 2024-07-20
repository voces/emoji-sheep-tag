import { SystemEntity } from "jsr:@verit/ecs";

import { app, Entity } from "../ecs.ts";
import { getLocalPlayer } from "../ui/vars/players.ts";
import { ExtendedSet } from "../util/ExtendedSet.ts";

export const selection = new ExtendedSet<
  SystemEntity<Entity, "selected">
>();

app.addSystem({ props: ["selected"], entities: selection });

// Auto select unit
app.addSystem({
  props: ["id", "unitType", "owner"],
  onAdd: (e) => {
    console.log("on add");
    if (
      e.owner === getLocalPlayer()?.id &&
      (e.unitType === "sheep" || e.unitType === "wolf")
    ) {
      e.selected = true;
    }
  },
});
