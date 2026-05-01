import { Command } from "@/components/game/Command.tsx";
import { Grid } from "./common.ts";
import { CollapsiblePanel } from "./CollapsiblePanel.tsx";
import { createBlueprint } from "../../../../controls/blueprintHandlers.ts";
import { mouse } from "../../../../mouse.ts";
import { tileDefs } from "@/shared/data.ts";
import {
  editorActiveActionVar,
  type EditorBrushShape,
  editorBrushShapeVar,
  type EditorBrushSize,
  editorBrushSizeVar,
  editorTerrainSelectionVar,
  editorTileModeVar,
  editorWaterLevelVar,
  type EditorWaterView,
  editorWaterViewVar,
} from "@/vars/editor.ts";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { NumericSettingInput } from "../../Lobby/NumericSettingInput.tsx";
import { VStack } from "@/components/layout/Layout.tsx";
import { useTranslation } from "react-i18next";
import { styled } from "styled-components";
import {
  ArrowDownFromLine,
  ArrowUpFromLine,
  Droplet,
  Eye,
  EyeOff,
  Minus,
  SquareDashed,
  TriangleRight,
} from "lucide-react";
import {
  Segment,
  SegmentedControlWide,
} from "@/components/forms/SegmentedControl.tsx";

const ToolIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: ${({ theme }) => theme.ink.hi};

  svg {
    width: 60%;
    height: 60%;
  }
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const SectionLabel = styled.div`
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 500;
`;

const waterViewKeys: EditorWaterView[] = ["hide", "normal", "level"];
const waterViewI18n: Record<EditorWaterView, string> = {
  hide: "editor.waterHide",
  normal: "editor.waterNormal",
  level: "editor.waterMask",
};

const brushSizeKeys: EditorBrushSize[] = [1, 2, 3, 4, 5, "fill", "all"];
const brushShapeKeys: EditorBrushShape[] = ["square", "circle"];
const brushShapeI18n: Record<EditorBrushShape, string> = {
  square: "editor.brushShapeSquare",
  circle: "editor.brushShapeCircle",
};

const brushSizeLabel = (
  size: EditorBrushSize,
  t: (key: string) => string,
): string => {
  if (size === "fill") return t("editor.brushSizeFill");
  if (size === "all") return t("editor.brushSizeAll");
  return String(size);
};

export const TerrainPanel = () => {
  const { t } = useTranslation();
  const waterLevel = useReactiveVar(editorWaterLevelVar);
  const waterView = useReactiveVar(editorWaterViewVar);
  const brushSize = useReactiveVar(editorBrushSizeVar);
  const brushShape = useReactiveVar(editorBrushShapeVar);
  const activeAction = useReactiveVar(editorActiveActionVar);
  const terrainSelection = useReactiveVar(editorTerrainSelectionVar);
  const waterPaintLabel = waterLevel > 0
    ? t("editor.paintWater", {
      level: waterLevel.toFixed(4).replace(/\.?0+$/, ""),
    })
    : t("editor.clearWater");
  const shapeDisabled = brushSize === "fill" || brushSize === "all" ||
    brushSize === 1;

  return (
    <CollapsiblePanel title={t("editor.terrain")} defaultOpen>
      <VStack>
        <Section>
          <SectionLabel>{t("editor.brushSize")}</SectionLabel>
          <SegmentedControlWide
            role="radiogroup"
            aria-label={t("editor.brushSize")}
            style={{
              gridTemplateColumns: `repeat(${brushSizeKeys.length}, 1fr)`,
            }}
          >
            {brushSizeKeys.map((size) => (
              <Segment
                key={String(size)}
                role="radio"
                aria-checked={brushSize === size}
                $active={brushSize === size}
                onClick={() => editorBrushSizeVar(size)}
              >
                {brushSizeLabel(size, t)}
              </Segment>
            ))}
          </SegmentedControlWide>
        </Section>
        <Section>
          <SectionLabel>{t("editor.brushShape")}</SectionLabel>
          <SegmentedControlWide
            role="radiogroup"
            aria-label={t("editor.brushShape")}
            style={{
              gridTemplateColumns: `repeat(${brushShapeKeys.length}, 1fr)`,
              opacity: shapeDisabled ? 0.5 : 1,
            }}
          >
            {brushShapeKeys.map((shape) => (
              <Segment
                key={shape}
                role="radio"
                aria-checked={brushShape === shape}
                $active={brushShape === shape}
                disabled={shapeDisabled}
                onClick={() => editorBrushShapeVar(shape)}
              >
                {t(brushShapeI18n[shape])}
              </Segment>
            ))}
          </SegmentedControlWide>
        </Section>
        <Section>
          <SectionLabel>{t("editor.tilesLabel")}</SectionLabel>
          <Grid>
            {tileDefs.map(({ name, color, pathing }) =>
              name === "Water" ? null : (
                <Command
                  key={name}
                  name={name}
                  icon="square"
                  iconProps={{
                    overlayStyle: {
                      backgroundColor: `#${
                        color.toString(16).padStart(6, "2")
                      }`,
                    },
                  }}
                  iconScale={0.85}
                  pressed={activeAction?.kind === "tile" &&
                    activeAction.color === color}
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
                    blueprint.alpha = 0;
                    editorActiveActionVar({ kind: "tile", color });
                  }}
                />
              )
            )}
            <Command
              name={t("editor.raiseCliff")}
              pressed={activeAction?.kind === "raise"}
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
                blueprint.alpha = 0;
                editorActiveActionVar({ kind: "raise" });
              }}
            >
              <ToolIcon>
                <ArrowUpFromLine />
              </ToolIcon>
            </Command>
            <Command
              name={t("editor.lowerCliff")}
              pressed={activeAction?.kind === "lower"}
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
                blueprint.alpha = 0;
                editorActiveActionVar({ kind: "lower" });
              }}
            >
              <ToolIcon>
                <ArrowDownFromLine />
              </ToolIcon>
            </Command>
            <Command
              name={t("editor.ramp")}
              pressed={activeAction?.kind === "ramp"}
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
                blueprint.alpha = 0;
                editorActiveActionVar({ kind: "ramp" });
              }}
            >
              <ToolIcon>
                <TriangleRight />
              </ToolIcon>
            </Command>
            <Command
              name={t("editor.plateau")}
              description={t("editor.plateauDescription")}
              pressed={activeAction?.kind === "plateau"}
              onClick={() => {
                editorTileModeVar("tile");
                const blueprint = createBlueprint(
                  "tile",
                  mouse.world.x,
                  mouse.world.y,
                );
                if (!blueprint) return;
                blueprint.vertexColor = 0xff04ff;
                blueprint.isDoodad = true;
                blueprint.alpha = 0;
                editorActiveActionVar({ kind: "plateau" });
              }}
            >
              <ToolIcon>
                <Minus />
              </ToolIcon>
            </Command>
            <Command
              name={waterPaintLabel}
              pressed={activeAction?.kind === "water"}
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
                blueprint.alpha = 0;
                editorActiveActionVar({ kind: "water" });
              }}
            >
              <ToolIcon>
                <Droplet />
              </ToolIcon>
            </Command>
            <Command
              name={t("editor.addMask")}
              description={t("editor.addMaskDescription")}
              pressed={activeAction?.kind === "mask"}
              onClick={() => {
                editorTileModeVar("paintMask");
                const blueprint = createBlueprint(
                  "tile",
                  mouse.world.x,
                  mouse.world.y,
                );
                if (!blueprint) return;
                blueprint.vertexColor = 0xff07ff;
                blueprint.isDoodad = true;
                blueprint.alpha = 0;
                editorActiveActionVar({ kind: "mask" });
              }}
            >
              <ToolIcon>
                <EyeOff />
              </ToolIcon>
            </Command>
            <Command
              name={t("editor.removeMask")}
              description={t("editor.removeMaskDescription")}
              pressed={activeAction?.kind === "unmask"}
              onClick={() => {
                editorTileModeVar("paintMask");
                const blueprint = createBlueprint(
                  "tile",
                  mouse.world.x,
                  mouse.world.y,
                );
                if (!blueprint) return;
                blueprint.vertexColor = 0xff08ff;
                blueprint.isDoodad = true;
                blueprint.alpha = 0;
                editorActiveActionVar({ kind: "unmask" });
              }}
            >
              <ToolIcon>
                <Eye />
              </ToolIcon>
            </Command>
            <Command
              name={t("editor.selectArea")}
              description={t("editor.selectAreaDescription")}
              // Stay highlighted while the selection persists, even when the
              // active tool has shifted (paste, etc.) — the selection itself
              // is the user-visible state.
              pressed={activeAction?.kind === "select" || !!terrainSelection}
              onClick={() => {
                // Clicking the icon while a selection exists clears it (a
                // common first instinct for "get rid of this rectangle").
                if (terrainSelection) {
                  editorTerrainSelectionVar(undefined);
                  return;
                }
                editorTileModeVar("tile");
                const blueprint = createBlueprint(
                  "tile",
                  mouse.world.x,
                  mouse.world.y,
                );
                if (!blueprint) return;
                // Sentinel: not used for terrain edits, just routes the click
                // through the tile-blueprint path so we get drag handling.
                blueprint.vertexColor = 0xff05ff;
                blueprint.isDoodad = true;
                blueprint.alpha = 0;
                editorActiveActionVar({ kind: "select" });
              }}
            >
              <ToolIcon>
                <SquareDashed />
              </ToolIcon>
            </Command>
          </Grid>
        </Section>
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
