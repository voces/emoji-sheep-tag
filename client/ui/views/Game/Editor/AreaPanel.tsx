import { Panel } from "./common.ts";
import { Minimap } from "../../../components/Minimap/index.tsx";
import { useEffect, useState } from "react";
import { send } from "../../../../client.ts";
import { styled } from "styled-components";
import { onMapChange } from "@/shared/map.ts";

const MinimapContainer = styled.div`
  position: relative;
`;

const ArrowButton = styled.button<{ $position: string }>`
  position: absolute;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;

  &.hover {
    color: rgba(255, 255, 255, 1);
  }

  ${(props) => {
    switch (props.$position) {
      case "top-terrain-expand":
        return "top: 2.5px; left: calc(50% - 12px); transform: translateX(-50%);";
      case "top-terrain-shrink":
        return "top: 4px; left: calc(50% + 12px); transform: translateX(-50%);";
      case "top-bounds-expand":
        return "top: 22.5px; left: calc(50% - 12px); transform: translateX(-50%);";
      case "top-bounds-shrink":
        return "top: 24px; left: calc(50% + 12px); transform: translateX(-50%);";
      case "bottom-terrain-expand":
        return "bottom: 2.5px; left: calc(50% - 12px); transform: translateX(-50%);";
      case "bottom-terrain-shrink":
        return "bottom: 4px; left: calc(50% + 12px); transform: translateX(-50%);";
      case "bottom-bounds-expand":
        return "bottom: 22.5px; left: calc(50% - 12px); transform: translateX(-50%);";
      case "bottom-bounds-shrink":
        return "bottom: 24px; left: calc(50% + 12px); transform: translateX(-50%);";
      case "left-terrain-expand":
        return "left: 2.5px; top: calc(50% - 12px); transform: translateY(-50%);";
      case "left-terrain-shrink":
        return "left: 4px; top: calc(50% + 12px); transform: translateY(-50%);";
      case "left-bounds-expand":
        return "left: 22.5px; top: calc(50% - 12px); transform: translateY(-50%);";
      case "left-bounds-shrink":
        return "left: 24px; top: calc(50% + 12px); transform: translateY(-50%);";
      case "right-terrain-expand":
        return "right: 2.5px; top: calc(50% - 12px); transform: translateY(-50%);";
      case "right-terrain-shrink":
        return "right: 4px; top: calc(50% + 12px); transform: translateY(-50%);";
      case "right-bounds-expand":
        return "right: 22.5px; top: calc(50% - 12px); transform: translateY(-50%);";
      case "right-bounds-shrink":
        return "right: 24px; top: calc(50% + 12px); transform: translateY(-50%);";
      default:
        return "";
    }
  }};
`;

const InfoDisplay = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  padding: 8px 8px 0 8px;
  text-align: center;
`;

export const AreaPanel = () => {
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [bounds, setBounds] = useState({
    min: { x: 0, y: 0 },
    max: { x: 0, y: 0 },
  });

  useEffect(() => {
    const unsubscribe = onMapChange((map) => {
      setMapSize({ width: map.width, height: map.height });
      setBounds(map.bounds);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const resizeTerrain = (direction: "top" | "bottom" | "left" | "right") => {
    send({ type: "editorResizeMap", direction, amount: 1 });
  };

  const shrinkTerrain = (direction: "top" | "bottom" | "left" | "right") => {
    send({ type: "editorResizeMap", direction, amount: -1 });
  };

  const expandBounds = (direction: "top" | "bottom" | "left" | "right") => {
    send({ type: "editorAdjustBounds", direction, amount: 1 });
  };

  const shrinkBounds = (direction: "top" | "bottom" | "left" | "right") => {
    send({ type: "editorAdjustBounds", direction, amount: -1 });
  };

  const boundsSpan = {
    x: bounds.max.x - bounds.min.x,
    y: bounds.max.y - bounds.min.y,
  };

  const formatBounds = (value: number) => {
    return Number.isInteger(value) ? value.toString() : value.toFixed(1);
  };

  return (
    <Panel>
      <MinimapContainer>
        <Minimap />
        {/* Top terrain arrows */}
        <ArrowButton
          $position="top-terrain-expand"
          onClick={() => resizeTerrain("top")}
          title="Expand terrain top"
        >
          ▲
        </ArrowButton>
        <ArrowButton
          $position="top-terrain-shrink"
          onClick={() => shrinkTerrain("top")}
          title="Shrink terrain top"
        >
          ▼
        </ArrowButton>

        {/* Top bounds arrows */}
        <ArrowButton
          $position="top-bounds-expand"
          onClick={() => expandBounds("top")}
          title="Expand bounds top"
        >
          △
        </ArrowButton>
        <ArrowButton
          $position="top-bounds-shrink"
          onClick={() => shrinkBounds("top")}
          title="Shrink bounds top"
        >
          ▽
        </ArrowButton>

        {/* Bottom terrain arrows */}
        <ArrowButton
          $position="bottom-terrain-expand"
          onClick={() => resizeTerrain("bottom")}
          title="Expand terrain bottom"
        >
          ▼
        </ArrowButton>
        <ArrowButton
          $position="bottom-terrain-shrink"
          onClick={() => shrinkTerrain("bottom")}
          title="Shrink terrain bottom"
        >
          ▲
        </ArrowButton>

        {/* Bottom bounds arrows */}
        <ArrowButton
          $position="bottom-bounds-expand"
          onClick={() => expandBounds("bottom")}
          title="Expand bounds bottom"
        >
          ▽
        </ArrowButton>
        <ArrowButton
          $position="bottom-bounds-shrink"
          onClick={() => shrinkBounds("bottom")}
          title="Shrink bounds bottom"
        >
          △
        </ArrowButton>

        {/* Left terrain arrows */}
        <ArrowButton
          $position="left-terrain-expand"
          onClick={() => resizeTerrain("left")}
          title="Expand terrain left"
        >
          ◀
        </ArrowButton>
        <ArrowButton
          $position="left-terrain-shrink"
          onClick={() => shrinkTerrain("left")}
          title="Shrink terrain left"
        >
          ▶
        </ArrowButton>

        {/* Left bounds arrows */}
        <ArrowButton
          $position="left-bounds-expand"
          onClick={() => expandBounds("left")}
          title="Expand bounds left"
        >
          ◁
        </ArrowButton>
        <ArrowButton
          $position="left-bounds-shrink"
          onClick={() => shrinkBounds("left")}
          title="Shrink bounds left"
        >
          ▷
        </ArrowButton>

        {/* Right terrain arrows */}
        <ArrowButton
          $position="right-terrain-expand"
          onClick={() => resizeTerrain("right")}
          title="Expand terrain right"
        >
          ▶
        </ArrowButton>
        <ArrowButton
          $position="right-terrain-shrink"
          onClick={() => shrinkTerrain("right")}
          title="Shrink terrain right"
        >
          ◀
        </ArrowButton>

        {/* Right bounds arrows */}
        <ArrowButton
          $position="right-bounds-expand"
          onClick={() => expandBounds("right")}
          title="Expand bounds right"
        >
          ▷
        </ArrowButton>
        <ArrowButton
          $position="right-bounds-shrink"
          onClick={() => shrinkBounds("right")}
          title="Shrink bounds right"
        >
          ◁
        </ArrowButton>
      </MinimapContainer>
      <InfoDisplay>
        Map: {mapSize.width} × {mapSize.height} | Bounds:{" "}
        {formatBounds(boundsSpan.x)} × {formatBounds(boundsSpan.y)}
      </InfoDisplay>
    </Panel>
  );
};
