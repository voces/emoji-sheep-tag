import { setFirst } from "../../server/util/set.ts";
import { isEnemy } from "../api/unit.ts";
import { isAlly } from "../api/unit.ts";
import { getActiveOrder, hasBlueprint } from "../controls.ts";
import { Entity } from "../ecs.ts";
import { mouse } from "../mouse.ts";
import { getLocalPlayer } from "../ui/vars/players.ts";

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
if (!cursor) throw new Error("Expected cursor element");

const getCursorVariant = (intersect: Entity | undefined) => {
  if (hasBlueprint()) return "hidden";
  const active = getActiveOrder()?.variant;
  if (active) return active;
  if (!intersect) return "default";
  const localPlayer = getLocalPlayer();
  if (!localPlayer) return "neutral";
  if (intersect.owner === localPlayer.id) return "control";
  if (isAlly(intersect, localPlayer)) return "ally";
  if (isEnemy(intersect, localPlayer)) return "enemy";
  return "neutral";
};

export const updateCursor = (updatePosition = false) => {
  if (updatePosition) {
    cursor.style.top = `${mouse.pixels.y}px`;
    cursor.style.left = `${mouse.pixels.x}px`;
  }

  const variant = getCursorVariant(setFirst(mouse.intersects));

  if (variant === "hidden") {
    document.body.style.cursor = "none";
    cursor.style.visibility = "hidden";
    return;
  }

  document.body.style.cursor = variants[variant].css;
  cursor.style.visibility = document.pointerLockElement ? "visible" : "hidden";
  cursor.style.filter = `hue-rotate(${variants[variant].hue}deg)`;
};

document.addEventListener("pointerlockchange", () => updateCursor(false));
