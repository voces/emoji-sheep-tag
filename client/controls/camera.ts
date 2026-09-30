import { Vector2 } from "three";
import { mouse, screenToWorld } from "../mouse.ts";
import { addSystem } from "@/shared/context.ts";
import { camera, getSpeedMultiplier } from "../graphics/three.ts";
import { updateCursor } from "../graphics/cursor.ts";
import { showCommandPaletteVar } from "@/vars/showCommandPalette.ts";
import { showSettingsVar } from "@/vars/showSettings.ts";
import { gameplaySettingsVar } from "@/vars/gameplaySettings.ts";
import { setZoom, showZoomMessage } from "../api/player.ts";
import { getMap } from "@/shared/map.ts";
import { keyboard } from "./keyboardHandlers.ts";
import { isGameElement } from "./domEventBridge.ts";

// Middle-click camera panning state
let panGrabPixels: { x: number; y: number } | null = null;

export const startPanGrab = (x: number, y: number) => {
  panGrabPixels = { x, y };
};

export const endPanGrab = () => {
  panGrabPixels = null;
};

// Camera controls
let zoomTimeout = 0;
globalThis.addEventListener("wheel", (e) => {
  const element = document.elementFromPoint(mouse.pixels.x, mouse.pixels.y);
  if (!isGameElement(element)) return;
  if (e.ctrlKey) return;
  const newZoom = Math.max(camera.position.z + (e.deltaY > 0 ? 1 : -1), 1);
  if (newZoom === camera.position.z) return;
  setZoom(newZoom, true);
  if (zoomTimeout) clearTimeout(zoomTimeout);
  zoomTimeout = setTimeout(showZoomMessage, 250);
});

// Camera panning
let startPan: number | undefined;
const grabWorld = new Vector2();
const cursorWorld = new Vector2();

addSystem({
  update: (scaledDelta, time) => {
    if (showSettingsVar() || document.activeElement !== document.body) {
      return false;
    }
    // Undo speed multiplier scaling so camera moves at wall-clock speed
    const delta = scaledDelta / (getSpeedMultiplier() || 1);
    const map = getMap();

    const skipKeyboard = showCommandPaletteVar() === "open";

    // Handle middle-click panning using raycaster approach
    if (panGrabPixels) {
      screenToWorld(panGrabPixels.x, panGrabPixels.y, grabWorld);
      screenToWorld(mouse.pixels.x, mouse.pixels.y, cursorWorld);
      const worldDeltaX = cursorWorld.x - grabWorld.x;
      const worldDeltaY = cursorWorld.y - grabWorld.y;

      // Move camera opposite to maintain cursor lock on world
      camera.position.x = Math.min(
        Math.max(map.bounds.min.x, camera.position.x - worldDeltaX),
        map.bounds.max.x,
      );
      camera.position.y = Math.min(
        Math.max(map.bounds.min.y, camera.position.y - worldDeltaY),
        map.bounds.max.y,
      );

      // Update grab position for next frame
      panGrabPixels.x = mouse.pixels.x;
      panGrabPixels.y = mouse.pixels.y;

      // Skip arrow/edge panning
      updateCursor();
      return;
    }

    let x = (keyboard.ArrowLeft && !skipKeyboard ? -1 : 0) +
      (keyboard.ArrowRight && !skipKeyboard ? 1 : 0) +
      (document.pointerLockElement
        ? (mouse.pixels.x <= 12 ? -2 : 0) +
          (globalThis.innerWidth - mouse.pixels.x <= 12 ? 2 : 0)
        : 0);
    let y = (keyboard.ArrowDown && !skipKeyboard ? -1 : 0) +
      (keyboard.ArrowUp && !skipKeyboard ? 1 : 0) +
      (document.pointerLockElement
        ? (mouse.pixels.y <= 12 ? 2 : 0) +
          (globalThis.innerHeight - mouse.pixels.y <= 12 ? -2 : 0)
        : 0);

    const panDuration = typeof startPan === "number" ? (time - startPan) : 0;

    const panSpeed = gameplaySettingsVar().panSpeed;
    if (x) {
      x *= 1 + 1.3 * Math.exp(-10 * panDuration) + (panDuration / 5) ** 0.5 -
        0.32;
      camera.position.x = Math.min(
        Math.max(
          map.bounds.min.x,
          camera.position.x + x * delta * camera.position.z * panSpeed,
        ),
        map.bounds.max.x,
      );
    }
    if (y) {
      y *= 1 + 1.3 * Math.exp(-10 * panDuration) + (panDuration / 5) ** 0.5 -
        0.32;
      camera.position.y = Math.min(
        Math.max(
          map.bounds.min.y,
          camera.position.y + y * delta * camera.position.z * panSpeed,
        ),
        map.bounds.max.y,
      );
    }

    if ((x || y) && typeof startPan !== "number") {
      startPan = time;
    } else if (!x && !y && typeof startPan === "number") {
      startPan = undefined;
    }

    updateCursor();
  },
});
