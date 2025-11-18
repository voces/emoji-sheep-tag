import { app } from "../ecs.ts";
import { terrain } from "../graphics/three.ts";
import { tileDefs } from "@/shared/data.ts";
import { packMap2D } from "@/shared/util/2dPacking.ts";
import { packEntities } from "@/shared/util/entityPacking.ts";
import { getMapBounds, getMapCenter, type PackedMap } from "@/shared/map.ts";
import { editorCurrentMapVar } from "@/vars/editor.ts";

export const buildPackedMapFromEditor = (): PackedMap => {
  let maxCliff = 0;
  const cliffs = terrain.masks.cliff.map((r) =>
    r.map((v) => {
      if (v === "r") return 0;
      if (v >= maxCliff) maxCliff = v;
      return v + 1;
    })
  ).reverse();

  const center = getMapCenter();
  const bounds = getMapBounds();
  const currentMap = editorCurrentMapVar();

  return {
    name: currentMap?.name,
    center,
    bounds,
    terrain: packMap2D(
      terrain.masks.groundTile.toReversed(),
      tileDefs.length,
    ),
    cliffs: packMap2D(cliffs, maxCliff + 1),
    entities: packEntities(
      Array.from(app.entities).filter((e) =>
        e.isDoodad && e.prefab && e.position &&
        !e.id.startsWith("blueprint-") &&
        !e.isEffect
      ),
    ),
  };
};
