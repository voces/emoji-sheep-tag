import { type PerspectiveCamera } from "three";
import { getMap } from "@/shared/map.ts";
import {
  mouse,
  type MouseButtonEvent,
  type MouseMoveEvent,
} from "../../../mouse.ts";

type State = {
  isInterpolating: boolean;
  isDragging: boolean;
  targetX: number;
  targetY: number;
};

export const createCameraMovement = (
  canvas: HTMLCanvasElement,
  mainCamera: PerspectiveCamera,
) => {
  const state: State = {
    isInterpolating: false,
    isDragging: false,
    targetX: mainCamera.position.x,
    targetY: mainCamera.position.y,
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

      state.targetX = worldX;
      state.targetY = worldY;
      state.isDragging = true;
      state.isInterpolating = true;
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

    state.targetX = worldX;
    state.targetY = worldY;
    state.isInterpolating = true;
  };

  const updateCameraSmooth = (delta: number) => {
    if (!state.isInterpolating) return;

    const lerpFactor = Math.min(1, delta * 15);
    mainCamera.position.x += (state.targetX - mainCamera.position.x) *
      lerpFactor;
    mainCamera.position.y += (state.targetY - mainCamera.position.y) *
      lerpFactor;

    const dx = state.targetX - mainCamera.position.x;
    const dy = state.targetY - mainCamera.position.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < 0.001) {
      state.isInterpolating = false;
    }
  };

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
