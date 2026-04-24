import { VStack } from "@/components/layout/Layout.tsx";
import { useSet } from "@/hooks/useSet.ts";
import { selection } from "../../../../systems/selection.ts";
import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";
import { send } from "../../../../messaging.ts";
import { Entity } from "@/shared/types.ts";
import { SystemEntity } from "../../../../ecs.ts";
import { useListenToEntities } from "@/hooks/useListenToEntityProp.ts";
import { CollapsiblePanel } from "./CollapsiblePanel.tsx";
import { deg2rad, rad2deg } from "@/shared/util/math.ts";
import { styled } from "styled-components";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

const change = (patch: Partial<Entity>) => {
  send({
    type: "editorUpdateEntities",
    entities: Array.from(selection, (e) => ({ id: e.id, ...patch })),
  });
};

const changePosition = (patch: Partial<NonNullable<Entity["position"]>>) => {
  send({
    type: "editorUpdateEntities",
    entities: Array.from(selection)
      .filter((e): e is SystemEntity<"selected" | "position"> => !!e.position)
      .map((e) => ({ id: e.id, position: { ...e.position, ...patch } })),
  });
};

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
`;

const Label = styled.label`
  font-size: ${({ theme }) => theme.text.sm};
  color: ${({ theme }) => theme.ink.mid};
  width: 44px;
  flex-shrink: 0;
`;

const InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
`;

const FieldInput = styled.input`
  width: 100%;
  min-width: 0;
  border: 0;
  background: ${({ theme }) => theme.surface[2]};
  color: ${({ theme }) => theme.ink.hi};
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[2]};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.text.sm};

  &.hover:not([disabled]) {
    background: ${({ theme }) => theme.surface[3]};
  }
`;

const ResetButton = styled.button`
  position: absolute;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: ${({ theme }) => theme.radius.xs};
  border: none;
  background: ${({ theme }) => theme.surface[3]};
  color: ${({ theme }) => theme.ink.lo};
  cursor: pointer;
  padding: 0;

  &.hover {
    color: ${({ theme }) => theme.ink.hi};
  }
`;

const ColorSwatch = styled.div<{ $color: string; $empty: boolean }>`
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border: 1px ${({ $empty }) => ($empty ? "dashed" : "solid")} ${({ theme }) =>
    theme.border.soft};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ $color, $empty, theme }) =>
    $empty ? theme.surface[2] : $color};
`;

const Unit = styled.span`
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
  flex-shrink: 0;
`;

const clearInput = (e: React.MouseEvent<HTMLButtonElement>) => {
  const input = e.currentTarget.parentElement?.querySelector("input");
  if (input) input.value = "";
};

const numToHex = (n: number | null | undefined) =>
  n != null ? `#${n.toString(16).padStart(6, "0")}` : "";

const hexToNum = (hex: string) => {
  const cleaned = hex.replace("#", "");
  if (!cleaned) return null;
  const v = parseInt(cleaned, 16);
  return isNaN(v) ? null : v;
};

const unique = <T,>(set: ExtendedSet<T>) =>
  set.size === 1 ? set.first() : undefined;

export const PropertiesPanel = () => {
  const { t } = useTranslation();
  useSet(selection);
  useListenToEntities(selection, [
    "name",
    "prefab",
    "vertexColor",
    "playerColor",
    "modelScale",
    "facing",
    "position",
  ]);

  if (!selection.size) return null;

  const names = new ExtendedSet(
    Array.from(selection, (e) => e.name ?? e.prefab),
  );
  const vertexColors = new ExtendedSet(
    Array.from(selection, (e) => e.vertexColor),
  );
  const playerColors = new ExtendedSet(
    Array.from(selection, (e) => e.playerColor),
  );
  const scales = new ExtendedSet(
    Array.from(selection, (e) => e.modelScale),
  );
  const facings = new ExtendedSet(
    Array.from(
      selection,
      (e) =>
        typeof e.facing === "number" ? Math.round(rad2deg(e.facing)) : e.facing,
    ),
  );
  const xs = new ExtendedSet(Array.from(selection, (e) => e.position?.x));
  const ys = new ExtendedSet(Array.from(selection, (e) => e.position?.y));

  const key = Array.from(selection, (e) => e.id).join("-");
  const name = names.size === 1 ? names.first() ?? "" : undefined;
  const title = name
    ? t("editor.propertiesTitle", { name })
    : t("editor.propertiesMixed");
  const mixed = selection.size > 1;

  const vertexHex = numToHex(unique(vertexColors));
  const playerHex = unique(playerColors);
  const hasVertex = !!vertexHex;
  const hasPlayer = !!playerHex;
  const hasScale = unique(scales) != null;
  const hasFacing = unique(facings) != null;

  return (
    <CollapsiblePanel title={title}>
      <VStack key={key} $gap={2}>
        <Row>
          <Label>{t("editor.vertex")}</Label>
          <ColorSwatch
            $color={vertexHex || "transparent"}
            $empty={!hasVertex}
          />
          <InputWrapper>
            <FieldInput
              defaultValue={vertexColors.size === 1 ? vertexHex : ""}
              placeholder={mixed ? "mixed" : "#hex"}
              onChange={(e) => {
                const val = e.currentTarget.value;
                if (!val) return change({ vertexColor: null });
                const v = hexToNum(val);
                if (v != null) change({ vertexColor: v });
              }}
              onBlur={(e) =>
                e.currentTarget.value = vertexColors.size === 1
                  ? vertexHex
                  : ""}
            />
            {hasVertex && (
              <ResetButton
                title={t("editor.clear")}
                onClick={(e) => {
                  clearInput(e);
                  change({ vertexColor: null });
                }}
              >
                <RotateCcw size={10} />
              </ResetButton>
            )}
          </InputWrapper>
        </Row>
        <Row>
          <Label>{t("editor.player")}</Label>
          <ColorSwatch
            $color={playerHex ?? "transparent"}
            $empty={!hasPlayer}
          />
          <InputWrapper>
            <FieldInput
              defaultValue={playerHex ?? ""}
              placeholder={mixed ? "mixed" : "#hex"}
              onChange={(e) =>
                change({ playerColor: e.currentTarget.value || null })}
              onBlur={(e) => e.currentTarget.value = `${playerHex ?? ""}`}
            />
            {hasPlayer && (
              <ResetButton
                title={t("editor.clear")}
                onClick={(e) => {
                  clearInput(e);
                  change({ playerColor: null });
                }}
              >
                <RotateCcw size={10} />
              </ResetButton>
            )}
          </InputWrapper>
        </Row>
        <Row>
          <Label>{t("editor.scale")}</Label>
          <InputWrapper>
            <FieldInput
              type="number"
              step={0.05}
              min={0.01}
              defaultValue={unique(scales) ?? ""}
              placeholder={mixed ? "mixed" : "1"}
              onChange={(e) => {
                const val = e.currentTarget.value;
                change({
                  modelScale: val ? (parseFloat(val) || null) : null,
                });
              }}
              onBlur={(e) => e.currentTarget.value = `${unique(scales) ?? ""}`}
            />
            {hasScale && (
              <ResetButton
                title={t("editor.clear")}
                onClick={(e) => {
                  clearInput(e);
                  change({ modelScale: null });
                }}
              >
                <RotateCcw size={10} />
              </ResetButton>
            )}
          </InputWrapper>
        </Row>
        <Row>
          <Label>{t("editor.facing")}</Label>
          <InputWrapper>
            <FieldInput
              type="number"
              step={1}
              min={0}
              max={360}
              defaultValue={unique(facings) ?? ""}
              placeholder={mixed ? "mixed" : "0"}
              onChange={(e) => {
                const val = e.currentTarget.value;
                if (!val) return change({ facing: null });
                const num = deg2rad(parseFloat(val) || 0);
                change({ facing: Number.isFinite(num) ? num : null });
              }}
              onBlur={(e) => e.currentTarget.value = `${unique(facings) ?? ""}`}
            />
            {hasFacing && (
              <ResetButton
                title={t("editor.clear")}
                onClick={(e) => {
                  clearInput(e);
                  change({ facing: null });
                }}
              >
                <RotateCcw size={10} />
              </ResetButton>
            )}
          </InputWrapper>
          <Unit>deg</Unit>
        </Row>
        <Row>
          <Label>X</Label>
          <InputWrapper>
            <FieldInput
              type="number"
              step={0.5}
              defaultValue={xs.size === 1 ? xs.first() ?? "" : ""}
              placeholder={mixed ? "mixed" : "0"}
              onChange={(e) =>
                changePosition({ x: parseFloat(e.currentTarget.value) ?? 0 })}
              onBlur={(e) =>
                e.currentTarget.value = `${
                  xs.size === 1 ? xs.first() ?? "" : ""
                }`}
            />
          </InputWrapper>
        </Row>
        <Row>
          <Label>Y</Label>
          <InputWrapper>
            <FieldInput
              type="number"
              step={0.5}
              defaultValue={ys.size === 1 ? ys.first() ?? "" : ""}
              placeholder={mixed ? "mixed" : "0"}
              onChange={(e) =>
                changePosition({ y: parseFloat(e.currentTarget.value) ?? 0 })}
              onBlur={(e) =>
                e.currentTarget.value = `${
                  ys.size === 1 ? ys.first() ?? "" : ""
                }`}
            />
          </InputWrapper>
        </Row>
      </VStack>
    </CollapsiblePanel>
  );
};
