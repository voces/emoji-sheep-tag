import { addSystem } from "../context.ts";
import { getMap } from "../map.ts";

// Sync map center with the map-center-marker entity position
addSystem({
  props: ["position"],
  onChange: (entity) => {
    if (entity.id !== "map-center-marker" || !entity.position) return;

    const map = getMap();
    map.center.x = entity.position.x;
    map.center.y = entity.position.y;
  },
});
