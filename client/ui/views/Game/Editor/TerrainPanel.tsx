import { Command } from "@/components/game/Command.tsx";
import { Grid, Panel } from "./common.ts";
import { createBlueprint } from "../../../../controls/blueprintHandlers.ts";
import { mouse } from "../../../../mouse.ts";
import { tiles } from "@/shared/data.ts";

export const TerrainPanel = () => (
  <Panel>
    <h4>Terrain</h4>
    <Grid>
      {tiles.map(({ name, color, pathing }) => (
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
    </Grid>
  </Panel>
);
