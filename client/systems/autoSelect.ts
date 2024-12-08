import { SystemEntity } from "jsr:@verit/ecs";

import { app, Entity } from "../ecs.ts";
import { isLocalPlayer } from "../ui/vars/players.ts";
import { ExtendedSet } from "../util/ExtendedSet.ts";
import { clearBlueprint } from "../controls.ts";

export const selection = new ExtendedSet<
  SystemEntity<Entity, "selected">
>();

app.addSystem({
  props: ["selected"],
  entities: selection,
  onRemove: () => {
    clearBlueprint((b) => {
      console.log(Array.from(selection));
      return !selection.some((s) =>
        s.actions?.some((a) => a.type === "build" && a.unitType === b.unitType)
      );
    });
  },
});

// Auto select unit
app.addSystem({
  props: ["id", "unitType", "owner"],
  onAdd: (e) => {
    if (
      isLocalPlayer(e.owner) &&
      (e.unitType === "sheep" || e.unitType === "wolf")
    ) e.selected = true;
  },
});
