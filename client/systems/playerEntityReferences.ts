import { app } from "../ecs.ts";
import { playersVar } from "../ui/vars/players.ts";

// System to manage player entity references for fast lookups
app.addSystem({
  props: ["isPlayer", "owner"],
  onAdd: (entity) => {
    if (entity.owner) {
      // Link player entity to player object
      playersVar((players) =>
        players.map((p) => p.id === entity.owner ? { ...p, entity } : p)
      );
    }
  },
  onRemove: (entity) => {
    if (entity.owner) {
      // Clear player entity reference
      playersVar((players) =>
        players.map((p) =>
          p.id === entity.owner ? { ...p, entity: undefined } : p
        )
      );
    }
  },
});
