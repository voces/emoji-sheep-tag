import { type PerspectiveCamera } from "three";
import { getMap } from "@/shared/map.ts";
import {
  mouse,
  type MouseButtonEvent,
  type MouseMoveEvent,
} from "../../../mouse.ts";
import { panCameraTo } from "../../../api/camera.ts";

type State = {
  isDragging: boolean;
};

export const createCameraMovement = (
  canvas: HTMLCanvasElement,
  _mainCamera: PerspectiveCamera,
) => {
  const state: State = {
    isDragging: false,
  };

  const handleMouseButtonDown = (e: MouseButtonEvent) => {
    if (e.button !== "left") return;
    if (
      !(e.element instanceof HTMLElement &&
        e.element.hasAttribute("data-minimap"))
    ) return;

    const shouldIssueOrder = e.hadActiveOrder || e.hadBlueprint;
    if (shouldIssueOrder) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.pixels.x - rect.left;
    const y = e.pixels.y - rect.top;

    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      const map = getMap();
      const mapWidth = map.bounds.max.x - map.bounds.min.x;
      const mapHeight = map.bounds.max.y - map.bounds.min.y;
      const worldX = map.bounds.min.x + (x / rect.width) * mapWidth;
      const worldY = map.bounds.max.y - (y / rect.height) * mapHeight;

      panCameraTo(worldX, worldY);
      state.isDragging = true;
    }
  };

  const handleMouseButtonUp = (e: MouseButtonEvent) => {
    if (e.button !== "left") return;
    state.isDragging = false;
  };

  const handleMouseMove = (e: MouseMoveEvent) => {
    if (!state.isDragging) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.pixels.x - rect.left;
    const y = e.pixels.y - rect.top;

    const map = getMap();
    const mapWidth = map.bounds.max.x - map.bounds.min.x;
    const mapHeight = map.bounds.max.y - map.bounds.min.y;
    const worldX = Math.max(
      map.bounds.min.x,
      Math.min(
        map.bounds.min.x + (x / rect.width) * mapWidth,
        map.bounds.max.x,
      ),
    );
    const worldY = Math.max(
      map.bounds.min.y,
      Math.min(
        map.bounds.max.y - (y / rect.height) * mapHeight,
        map.bounds.max.y,
      ),
    );

    panCameraTo(worldX, worldY);
  };

  // No longer needed - interpolation is now handled by camera.ts onRender
  const updateCameraSmooth = (_delta: number) => {};

  mouse.addEventListener("mouseButtonDown", handleMouseButtonDown);
  mouse.addEventListener("mouseButtonUp", handleMouseButtonUp);
  mouse.addEventListener("mouseMove", handleMouseMove);

  return {
    updateCameraSmooth,
    dispose: () => {
      mouse.removeEventListener("mouseButtonDown", handleMouseButtonDown);
      mouse.removeEventListener("mouseButtonUp", handleMouseButtonUp);
      mouse.removeEventListener("mouseMove", handleMouseMove);
    },
  };
};
