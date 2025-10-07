import { useMemo } from "react";
import { editorVar } from "@/vars/editor.ts";
import { app } from "../../../ecs.ts";
import { terrain } from "../../../graphics/three.ts";
import { tileDefs } from "@/shared/data.ts";
import { packMap2D } from "@/shared/util/2dPacking.ts";
import { packEntities } from "@/shared/util/entityPacking.ts";
import { bounds, center } from "@/shared/map.ts";

export const useExportMap = () =>
  useMemo(() => ({
    name: "Export map",
    description: "Exports the map as JS",
    valid: editorVar,
    callback: () => {
      let maxCliff = 0;
      const cliffs = terrain.masks.cliff.map((r) =>
        r.map((v) => {
          if (v === "r") return 0;
          if (v >= maxCliff) maxCliff = v;
          return v + 1;
        })
      ).reverse();

      console.log({
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
            !e.id.startsWith("blueprint-")
          ),
        ),
      });
    },
  }), []);
