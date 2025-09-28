import { Command } from "@/components/game/Command.tsx";
import { Grid, Panel } from "./common.ts";
import { createBlueprint } from "../../../../controls/blueprintHandlers.ts";
import { mouse } from "../../../../mouse.ts";
import { tileDefs } from "@/shared/data.ts";

export const TerrainPanel = () => (
  <Panel>
    <h4>Terrain</h4>
    <Grid>
      {tileDefs.map(({ name, color, pathing }) => (
        <Command
          key={name}
          name={name}
          icon="square"
          iconProps={{
            overlayStyle: {
              backgroundColor: `#${color.toString(16).padStart(6, "2")}`,
            },
          }}
          iconScale={0.85}
          onClick={() => {
            const blueprint = createBlueprint(
              "tile",
              mouse.world.x,
              mouse.world.y,
            );
            if (!blueprint) return;
            blueprint.vertexColor = color;
            blueprint.isDoodad = true;
            blueprint.pathing = pathing;
          }}
        />
      ))}
      <Command
        name="Raise cliff"
        icon="square"
        // iconProps={{
        //   overlayStyle: {
        //     backgroundColor: `#${color.toString(16).padStart(6, "2")}`,
        //   },
        // }}
        iconScale={0.85}
        onClick={() => {
          const blueprint = createBlueprint(
            "tile",
            mouse.world.x,
            mouse.world.y,
          );
          if (!blueprint) return;
          blueprint.vertexColor = 0xff01ff;
          blueprint.isDoodad = true;
        }}
      />
      <Command
        name="Lower cliff"
        icon="square"
        iconScale={0.85}
        onClick={() => {
          const blueprint = createBlueprint(
            "tile",
            mouse.world.x,
            mouse.world.y,
          );
          if (!blueprint) return;
          blueprint.vertexColor = 0xff02ff;
          blueprint.isDoodad = true;
        }}
      />
      <Command
        name="Ramp"
        icon="square"
        iconScale={0.85}
        onClick={() => {
          const blueprint = createBlueprint(
            "tile",
            mouse.world.x,
            mouse.world.y,
          );
          if (!blueprint) return;
          blueprint.vertexColor = 0xff03ff;
          blueprint.isDoodad = true;
        }}
      />
    </Grid>
  </Panel>
);
