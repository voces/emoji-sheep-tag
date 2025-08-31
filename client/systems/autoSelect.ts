import { app, Entity, SystemEntity } from "../ecs.ts";
import { isLocalPlayer } from "@/vars/players.ts";
import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";
import { cancelOrder } from "../controls.ts";
import { selectEntity } from "../api/selection.ts";

export const selection = new ExtendedSet<SystemEntity<"selected">>();

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
  props: ["id", "prefab", "owner"],
  onAdd: (e) => {
    if (
      isLocalPlayer(e.owner) &&
      (e.prefab === "sheep" || e.prefab === "wolf" || e.prefab === "spirit")
    ) {
      if (selection.size === 0) selectEntity(e);
      primary = e;
    }
  },
  onRemove: (e) => {
    if (e === primary) primary = undefined;
  },
});
