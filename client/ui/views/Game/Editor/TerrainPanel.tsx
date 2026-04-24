import { Command } from "@/components/game/Command.tsx";
import { Grid } from "./common.ts";
import { CollapsiblePanel } from "./CollapsiblePanel.tsx";
import { createBlueprint } from "../../../../controls/blueprintHandlers.ts";
import { mouse } from "../../../../mouse.ts";
import { tileDefs } from "@/shared/data.ts";
import {
  editorTileModeVar,
  editorWaterLevelVar,
  type EditorWaterView,
  editorWaterViewVar,
} from "@/vars/editor.ts";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { NumericSettingInput } from "../../Lobby/NumericSettingInput.tsx";
import { SmallButton } from "@/components/forms/ActionButton.tsx";
import { VStack } from "@/components/layout/Layout.tsx";
import {
  executeCommand,
  fillWaterCommand,
} from "../../../../editor/commands.ts";
import { WATER_LEVEL_SCALE } from "@/shared/constants.ts";
import { useTranslation } from "react-i18next";
import {
  Segment,
  SegmentedControlWide,
} from "@/components/forms/SegmentedControl.tsx";

const waterViewKeys: EditorWaterView[] = ["hide", "normal", "level"];
const waterViewI18n: Record<EditorWaterView, string> = {
  hide: "editor.waterHide",
  normal: "editor.waterNormal",
  level: "editor.waterMask",
};

export const TerrainPanel = () => {
  const { t } = useTranslation();
  const waterLevel = useReactiveVar(editorWaterLevelVar);
  const waterView = useReactiveVar(editorWaterViewVar);
  const waterPaintLabel = waterLevel > 0
    ? t("editor.paintWater", {
      level: waterLevel.toFixed(4).replace(/\.?0+$/, ""),
    })
    : t("editor.clearWater");

  return (
    <CollapsiblePanel title={t("editor.terrain")} defaultOpen>
      <VStack>
        <Grid>
          {tileDefs.map(({ name, color, pathing }) =>
            name === "Water" ? null : (
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
                  editorTileModeVar("tile");
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
            )
          )}
          <Command
            name={t("editor.raiseCliff")}
            icon="raise"
            iconScale={0.85}
            onClick={() => {
              editorTileModeVar("tile");
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
            name={t("editor.lowerCliff")}
            icon="lower"
            iconScale={0.85}
            onClick={() => {
              editorTileModeVar("tile");
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
            name={t("editor.ramp")}
            icon="ramp"
            iconScale={0.85}
            onClick={() => {
              editorTileModeVar("tile");
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
          <Command
            name={waterPaintLabel}
            icon="waterDrop"
            iconScale={0.85}
            onClick={() => {
              editorTileModeVar("paintWater");
              const blueprint = createBlueprint(
                "tile",
                mouse.world.x,
                mouse.world.y,
              );
              if (!blueprint) return;
              blueprint.vertexColor = 0x385670;
              blueprint.isDoodad = true;
              blueprint.alpha = 0.75;
            }}
          />
        </Grid>
        <NumericSettingInput
          id="editor-water-level"
          label={t("editor.waterLevel")}
          value={waterLevel}
          min={0}
          max={16}
          step={0.0625}
          defaultValue="1.25"
          disabled={false}
          onChange={editorWaterLevelVar}
        />
        <SmallButton
          onClick={() => {
            const newValue = Math.max(
              0,
              Math.round(editorWaterLevelVar() * WATER_LEVEL_SCALE),
            );
            executeCommand(fillWaterCommand(newValue));
          }}
        >
          {t("editor.fillAllWater")}
        </SmallButton>
        <SegmentedControlWide
          role="radiogroup"
          aria-label={t("editor.waterView", { defaultValue: "Water view" })}
          style={{
            gridTemplateColumns: `repeat(${waterViewKeys.length}, 1fr)`,
          }}
        >
          {waterViewKeys.map((mode) => (
            <Segment
              key={mode}
              role="radio"
              aria-checked={waterView === mode}
              $active={waterView === mode}
              onClick={() => editorWaterViewVar(mode)}
            >
              {t(waterViewI18n[mode])}
            </Segment>
          ))}
        </SegmentedControlWide>
      </VStack>
    </CollapsiblePanel>
  );
};
