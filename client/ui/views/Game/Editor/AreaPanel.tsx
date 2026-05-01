import { Panel } from "./common.ts";
import { Minimap } from "../../../components/Minimap/index.tsx";
import { Fragment, useEffect, useRef, useState } from "react";
import { send } from "../../../../messaging.ts";
import { styled } from "styled-components";
import { onMapChange } from "@/shared/map.ts";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Minus, Plus } from "lucide-react";
import Collapse from "@/components/layout/Collapse.tsx";
import { camera } from "../../../../graphics/three.ts";
import { getEntityShiftForResize } from "@/shared/map/resizeMap.ts";
import { editorMapTagsVar } from "@/vars/editor.ts";
import { useReactiveVar } from "@/hooks/useVar.tsx";

const MinimapContainer = styled.div`
  position: relative;

  & > canvas {
    border-radius: ${({ theme }) => theme.radius.md} ${({ theme }) =>
      theme.radius.md} 0 0;
    display: block;
  }
`;

const TagOverlay = styled.div`
  position: absolute;
  top: ${({ theme }) => theme.space[1]};
  right: ${({ theme }) => theme.space[1]};
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  pointer-events: none;
`;

const TagPill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.radius.pill ?? theme.radius.sm};
  font-size: ${({ theme }) => theme.text.xs};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  background: color-mix(
    in oklab,
    ${({ theme }) => theme.surface[2]} 80%,
    transparent
  );
  color: ${({ theme }) => theme.ink.hi};
  pointer-events: auto;
  backdrop-filter: blur(2px);
`;

const InfoDisplay = styled.div`
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
  text-align: center;
`;

const ResizeHeader = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  width: 100%;
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[3]};
  background: transparent;
  border: none;
  border-top: 1px solid ${({ theme }) => theme.border.soft};
  color: ${({ theme }) => theme.ink.mid};
  font-size: ${({ theme }) => theme.text.xs};
  text-align: left;
  cursor: pointer;

  &.hover {
    color: ${({ theme }) => theme.ink.hi};
  }
`;

const Chev = styled.span`
  display: inline-flex;
  align-items: center;
  color: ${({ theme }) => theme.ink.lo};
`;

const ResizeBody = styled.div`
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]} ${(
    { theme },
  ) => theme.space[3]};
`;

const ResizeGrid = styled.div`
  display: grid;
  grid-template-columns: auto 1fr 1fr;
  gap: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[2]};
  align-items: center;
  font-size: ${({ theme }) => theme.text.xs};
`;

const ColumnHeader = styled.span`
  font-weight: 600;
  color: ${({ theme }) => theme.ink.mid};
  text-align: center;
`;

const SideLabel = styled.span`
  color: ${({ theme }) => theme.ink.lo};
`;

const AdjustCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space[1]};
`;

const AdjustButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1px solid ${({ theme }) => theme.border.soft};
  border-radius: ${({ theme }) => theme.radius.xs};
  background: ${({ theme }) => theme.surface[2]};
  color: ${({ theme }) => theme.ink.mid};
  cursor: pointer;
  padding: 0;

  &.hover {
    background: ${({ theme }) => theme.surface[3]};
    color: ${({ theme }) => theme.ink.hi};
  }
`;

type Direction = "top" | "bottom" | "left" | "right";
const directions: Direction[] = ["top", "bottom", "left", "right"];
const directionI18n: Record<Direction, string> = {
  top: "editor.top",
  bottom: "editor.bottom",
  left: "editor.left",
  right: "editor.right",
};

export const AreaPanel = () => {
  const { t } = useTranslation();
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [bounds, setBounds] = useState({
    min: { x: 0, y: 0 },
    max: { x: 0, y: 0 },
  });
  const [resizeOpen, setResizeOpen] = useState(false);
  const hasBeenOpened = useRef(false);
  if (resizeOpen) hasBeenOpened.current = true;
  const tags = useReactiveVar(editorMapTagsVar);

  useEffect(() => {
    const unsubscribe = onMapChange((map) => {
      setMapSize({ width: map.width, height: map.height });
      setBounds(map.bounds);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const boundsSpan = {
    x: bounds.max.x - bounds.min.x,
    y: bounds.max.y - bounds.min.y,
  };

  const resizeTerrain = (direction: Direction, amount: number) => {
    const shift = getEntityShiftForResize({ direction, amount });
    camera.position.x += shift.x;
    camera.position.y += shift.y;
    send({ type: "editorResizeMap", direction, amount });
  };

  const fmt = (value: number) =>
    Number.isInteger(value) ? value.toString() : value.toFixed(1);

  return (
    <Panel style={{ padding: 0 }}>
      <MinimapContainer>
        <Minimap />
        {tags.length > 0 && (
          <TagOverlay>
            {tags.map((tag) => (
              <TagPill
                key={tag}
                title={t("editor.tagQualifies", {
                  tag: t(`mapTag.${tag}`, { defaultValue: tag }),
                })}
              >
                {t(`mapTag.${tag}`, { defaultValue: tag })}
              </TagPill>
            ))}
          </TagOverlay>
        )}
      </MinimapContainer>
      <InfoDisplay>
        {t("editor.mapSize", { w: mapSize.width, h: mapSize.height })}
        {" | "}
        {t("editor.boundsSize", {
          bw: fmt(boundsSpan.x),
          bh: fmt(boundsSpan.y),
        })}
      </InfoDisplay>
      <ResizeHeader onClick={() => setResizeOpen(!resizeOpen)}>
        <Chev>
          {resizeOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </Chev>
        {t("editor.resizeMap")}
      </ResizeHeader>
      <Collapse isOpen={resizeOpen}>
        {hasBeenOpened.current && (
          <ResizeBody>
            <ResizeGrid>
              <span />
              <ColumnHeader>{t("editor.mapTerrain")}</ColumnHeader>
              <ColumnHeader>{t("editor.mapBounds")}</ColumnHeader>
              {directions.map((dir) => (
                <Fragment key={dir}>
                  <SideLabel>
                    {t(directionI18n[dir])}
                  </SideLabel>
                  <AdjustCell>
                    <AdjustButton
                      title={`${t("editor.mapTerrain")} ${
                        t(directionI18n[dir])
                      } −1`}
                      onClick={() => resizeTerrain(dir, -1)}
                    >
                      <Minus size={12} />
                    </AdjustButton>
                    <AdjustButton
                      title={`${t("editor.mapTerrain")} ${
                        t(directionI18n[dir])
                      } +1`}
                      onClick={() => resizeTerrain(dir, 1)}
                    >
                      <Plus size={12} />
                    </AdjustButton>
                  </AdjustCell>
                  <AdjustCell>
                    <AdjustButton
                      title={`${t("editor.mapBounds")} ${
                        t(directionI18n[dir])
                      } −1`}
                      onClick={() =>
                        send({
                          type: "editorAdjustBounds",
                          direction: dir,
                          amount: -1,
                        })}
                    >
                      <Minus size={12} />
                    </AdjustButton>
                    <AdjustButton
                      title={`${t("editor.mapBounds")} ${
                        t(directionI18n[dir])
                      } +1`}
                      onClick={() =>
                        send({
                          type: "editorAdjustBounds",
                          direction: dir,
                          amount: 1,
                        })}
                    >
                      <Plus size={12} />
                    </AdjustButton>
                  </AdjustCell>
                </Fragment>
              ))}
            </ResizeGrid>
          </ResizeBody>
        )}
      </Collapse>
    </Panel>
  );
};
