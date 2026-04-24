import { prefabs } from "@/shared/data.ts";
import { Command } from "@/components/game/Command.tsx";
import { createBlueprint } from "../../../../controls/blueprintHandlers.ts";
import { mouse } from "../../../../mouse.ts";
import { Grid } from "./common.ts";
import { CollapsiblePanel } from "./CollapsiblePanel.tsx";
import { useTranslation } from "react-i18next";

export const pickDoodad = (prefab: string) => {
  const blueprint = createBlueprint(prefab, mouse.world.x, mouse.world.y);
  if (blueprint?.prefab === "flowers") {
    blueprint.modelScale = Math.round((1 + (Math.random() - 0.5)) * 100) / 100;
    const r = Math.random();
    const g = Math.random();
    const b = Math.random();
    const scale = Math.min(1 / r, 1 / g, 1 / b) * 255;
    blueprint.playerColor = `#${
      Math.floor(r * scale).toString(16).padStart(2, "0")
    }${Math.floor(g * scale).toString(16).padStart(2, "0")}${
      Math.floor(b * scale).toString(16).padStart(2, "0")
    }`;
    blueprint.facing = Math.round(Math.random()) * Math.PI;
    blueprint.isDoodad = true;
  } else if (blueprint?.prefab === "scarecrow") {
    blueprint.modelScale = Math.round((1 + (Math.random() - 0.5) / 10) * 100) /
      100;
    const r = Math.floor(Math.random() * 255).toString(16).padStart(2, "0");
    const g = Math.floor(Math.random() * 255).toString(16).padStart(2, "0");
    const b = Math.floor(Math.random() * 255).toString(16).padStart(2, "0");
    blueprint.playerColor = `#${r}${g}${b}`;
    blueprint.isDoodad = true;
  }
};

export const DoodadsPanel = () => {
  const { t } = useTranslation();
  return (
    <CollapsiblePanel title={t("editor.doodads")}>
      <Grid>
        {Object.entries(prefabs).filter(([prefab, v]) =>
          v.isDoodad && prefab !== "tile"
        ).map(([k, v]) => (
          <Command
            key={k}
            name={v.name ?? k}
            icon={v.model ?? k}
            onClick={() => pickDoodad(k)}
          />
        ))}
      </Grid>
    </CollapsiblePanel>
  );
};
