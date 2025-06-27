import { SystemEntity } from "jsr:@verit/ecs";

import { app, Entity } from "../ecs.ts";
import { isLocalPlayer } from "../ui/vars/players.ts";
import { ExtendedSet } from "../util/ExtendedSet.ts";
import { cancelOrder } from "../controls.ts";
import { selectEntity } from "../api/selection.ts";

export const selection = new ExtendedSet<
  SystemEntity<Entity, "selected">
>();

let primary: Entity | undefined;

app.addSystem({
  props: ["selected"],
  entities: selection,
  onRemove: () => {
    cancelOrder((order, blueprint) =>
      !selection.some((s) =>
        s.actions?.some((a) =>
          (a.type === "build" && a.unitType === blueprint) ||
          (a.type === "target" && a.order === order)
        )
      )
    );
    if (!selection.size && primary) {
      queueMicrotask(() => !selection.size && primary && selectEntity(primary));
    }
  },
});

// Auto select unit
app.addSystem({
  props: ["id", "unitType", "owner"],
  onAdd: (e) => {
    if (
      isLocalPlayer(e.owner) &&
      (e.unitType === "sheep" || e.unitType === "wolf")
    ) {
      if (selection.size === 0) selectEntity(e);
      primary = e;
    }
  },
  onRemove: (e) => {
    if (e === primary) primary = undefined;
  },
});
