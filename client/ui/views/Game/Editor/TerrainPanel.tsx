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
import { Button } from "@/components/forms/Button.tsx";
import { HStack, VStack } from "@/components/layout/Layout.tsx";
import {
  executeCommand,
  fillWaterCommand,
} from "../../../../editor/commands.ts";
import { WATER_LEVEL_SCALE } from "@/shared/constants.ts";
import { styled } from "styled-components";

const waterViewLabels: Record<EditorWaterView, string> = {
  hide: "Hide",
  normal: "Normal",
  level: "Mask",
};

const SegmentedButton = styled(Button)<{ $active: boolean }>`
  flex: 1;
  padding: 2px ${({ theme }) => theme.space[1]};
  opacity: ${({ $active }) => ($active ? 1 : 0.6)};
  font-weight: ${({ $active }) => ($active ? "bold" : "normal")};
`;

export const TerrainPanel = () => {
  const waterLevel = useReactiveVar(editorWaterLevelVar);
  const waterView = useReactiveVar(editorWaterViewVar);
  const waterPaintLabel = waterLevel > 0
    ? `Paint water (${waterLevel.toFixed(4).replace(/\.?0+$/, "")})`
    : "Clear water";

  return (
    <CollapsiblePanel title="Terrain" defaultOpen>
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
            name="Raise cliff"
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
            name="Lower cliff"
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
            name="Ramp"
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
          label="Water level"
          value={waterLevel}
          min={0}
          max={16}
          step={0.0625}
          defaultValue="1.25"
          disabled={false}
          onChange={editorWaterLevelVar}
        />
        <Button
          onClick={() => {
            const newValue = Math.max(
              0,
              Math.round(editorWaterLevelVar() * WATER_LEVEL_SCALE),
            );
            executeCommand(fillWaterCommand(newValue));
          }}
        >
          Fill all water
        </Button>
        <HStack $gap={1} role="radiogroup" aria-label="Water view">
          {(["hide", "normal", "level"] as const).map((mode) => (
            <SegmentedButton
              key={mode}
              role="radio"
              aria-checked={waterView === mode}
              $active={waterView === mode}
              onClick={() => editorWaterViewVar(mode)}
            >
              {waterViewLabels[mode]}
            </SegmentedButton>
          ))}
        </HStack>
      </VStack>
    </CollapsiblePanel>
  );
};
