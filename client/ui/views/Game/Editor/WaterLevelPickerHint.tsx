import { useEffect, useState } from "react";
import { styled } from "styled-components";
import { useTranslation } from "react-i18next";
import { mouse } from "../../../../mouse.ts";
import { sampleWaterLevelAtWorld } from "../../../../editor/waterPicker.ts";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { editorPickWaterLevelVar } from "@/vars/editor.ts";

const HINT_OFFSET_X = 18;
const HINT_OFFSET_Y = 18;

const Hint = styled.div`
  position: fixed;
  background: ${({ theme }) => theme.surface.scrim};
  backdrop-filter: blur(12px);
  border: 1px solid ${({ theme }) => theme.border.soft};
  border-radius: ${({ theme }) => theme.radius.sm};
  box-shadow: ${({ theme }) => theme.shadow.md};
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.text.sm};
  font-family: ${({ theme }) => theme.font.mono};
  color: ${({ theme }) => theme.ink.hi};
  white-space: nowrap;
  pointer-events: none;
  z-index: 9999;
`;

const Label = styled.span`
  color: ${({ theme }) => theme.ink.lo};
  margin-right: ${({ theme }) => theme.space[1]};
`;

const formatLevel = (level: number) =>
  level === 0 ? "0" : level.toFixed(4).replace(/\.?0+$/, "");

export const WaterLevelPickerHint = () => {
  const { t } = useTranslation();
  const picking = useReactiveVar(editorPickWaterLevelVar);
  const [pos, setPos] = useState({ x: mouse.pixels.x, y: mouse.pixels.y });
  const [level, setLevel] = useState(() =>
    sampleWaterLevelAtWorld(mouse.world.x, mouse.world.y)
  );

  useEffect(() => {
    if (!picking) return;
    const update = () => {
      setPos({ x: mouse.pixels.x, y: mouse.pixels.y });
      setLevel(sampleWaterLevelAtWorld(mouse.world.x, mouse.world.y));
    };
    update();
    mouse.addEventListener("mouseMove", update);
    return () => mouse.removeEventListener("mouseMove", update);
  }, [picking]);

  if (!picking) return null;

  return (
    <Hint style={{ left: pos.x + HINT_OFFSET_X, top: pos.y + HINT_OFFSET_Y }}>
      <Label>{t("editor.waterLevel")}</Label>
      {formatLevel(level)}
    </Hint>
  );
};
