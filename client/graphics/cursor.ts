import { setFirst } from "../../server/util/set.ts";
import { isAlly, isEnemy } from "@/shared/api/unit.ts";
import { getActiveOrder, hasBlueprint } from "../controls.ts";
import { Entity } from "../ecs.ts";
import { mouse } from "../mouse.ts";
import { getLocalPlayer } from "@/vars/players.ts";
import cursorSvg from "../assets/cursor.svg" with { type: "text" };
import circleSvg from "../assets/circle.svg" with { type: "text" };
import { camera, renderer } from "./three.ts";
import { MathUtils } from "three";

const pointerSvg = new DOMParser().parseFromString(
  cursorSvg,
  "application/xml",
);
const aoeSvg = new DOMParser().parseFromString(
  circleSvg.replace("#ffffff", "#31aaef"),
  "application/xml",
);

const variants = {
  default: { css: "default", hue: 0 },
  control: { css: "grab", hue: 270 },
  enemy: { css: "crosshair", hue: 150 },
  ally: { css: "pointer", hue: 315 },
  neutral: { css: "pointer", hue: 180 },
};
export type CursorVariant = keyof typeof variants;
// 0 blue
// 30 bluepurple
// 60 purple
// 90 pink
// 120 pink red (salmon)
// 150 red
// 180 orange
// 210 olive
// 240 olive green
// 270 green
// 300 mint green
// 330 aquamarine

const cursor = document.getElementById("cursor");
// if (!cursor) throw new Error("Expected cursor element");

const getCursorVariant = (intersect: Entity | undefined) => {
  if (hasBlueprint()) return "hidden";
  const active = getActiveOrder()?.variant;
  if (active) return active;
  if (!intersect) return "default";
  const localPlayer = getLocalPlayer();
  if (!localPlayer) return "neutral";
  if (intersect.owner === localPlayer.id) return "control";
  if (isAlly(intersect, localPlayer.id)) return "ally";
  if (isEnemy(intersect, localPlayer.id)) return "enemy";
  return "neutral";
};

/** world units per CSS pixel at the camera's current height/FOV */
const worldUnitsPerPixel = () => {
  if (!renderer) return 0.011657691453874968;
  const vFov = MathUtils.degToRad(camera.fov); // vertical FOV in radians
  const z = camera.position.z; // camera height above the plane
  const viewportH = renderer.domElement.clientHeight; // CSS pixels
  return (2 * z * Math.tan(vFov / 2)) / viewportH; // world units per pixel
};

/** pixels per world unit (inverse of the above) */
const pixelsPerWorldUnit = () => 1 / worldUnitsPerPixel();

/** AOE circle size in pixels for a given world-space radius */
const aoeDiameterPx = (radiusWorld: number) =>
  2 * radiusWorld * pixelsPerWorldUnit();

export const updateCursor = (updatePosition = false) => {
  if (updatePosition && cursor) {
    cursor.style.top = `${mouse.pixels.y}px`;
    cursor.style.left = `${mouse.pixels.x}px`;
  }

  const variant = getCursorVariant(setFirst(mouse.intersects));
  const aoe = getActiveOrder()?.aoe;

  if (variant === "hidden") {
    document.body.style.cursor = "none";
    if (cursor) cursor.style.visibility = "hidden";
    return;
  }

  document.body.style.cursor = variants[variant].css;
  if (cursor) {
    cursor.style.visibility = document.pointerLockElement
      ? "visible"
      : "hidden";

    if (!aoe) {
      if (cursor.dataset.mode !== "pointer") {
        cursor.dataset.mode = "pointer";
        cursor.style.width = "24px";
        cursor.style.height = "24px";
        cursor.style.transform = "";
        cursor.setAttribute(
          "viewBox",
          pointerSvg.documentElement.getAttribute("viewBox") ?? "",
        );
        cursor.innerHTML = pointerSvg.documentElement.innerHTML;
      }
    } else {
      const diameter = aoeDiameterPx(aoe);
      if (cursor.dataset.mode !== "aoe") {
        cursor.dataset.mode = "aoe";
        cursor.setAttribute(
          "viewBox",
          aoeSvg.documentElement.getAttribute("viewBox") ?? "",
        );
        cursor.innerHTML = aoeSvg.documentElement.innerHTML;
      }
      // Always update transform for zoom changes
      cursor.style.width = `${diameter}px`;
      cursor.style.height = `${diameter}px`;
      cursor.style.transform = "translate(-50%, -50%)";
    }

    cursor.style.filter = `hue-rotate(${variants[variant].hue}deg)`;
  }
};

document.addEventListener("pointerlockchange", () => updateCursor(true));
