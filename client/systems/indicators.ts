import { SystemEntity } from "../ecs.ts";
import { getLocalPlayer } from "../api/player.ts";
import { addSystem, appContext } from "@/shared/context.ts";
import { addEntity, removeEntity } from "@/shared/api/entity.ts";
import { panCameraTo } from "../api/camera.ts";

const indicators = new Map<
  SystemEntity<"prefab" | "modelScale">,
  { birth: number; initialScale: number }
>();

// Track recent ping locations for "jump to ping" feature
const MAX_PINGS = 10;
const pingPositions: { x: number; y: number }[] = [];
let currentPingIndex = -1;

export const jumpToNextPing = (): boolean => {
  if (pingPositions.length === 0) return false;

  // Move to next ping (cycling backwards through history)
  currentPingIndex = (currentPingIndex + 1) % pingPositions.length;
  const ping = pingPositions[currentPingIndex];
  panCameraTo(ping.x, ping.y);
  return true;
};

export const clearPingHistory = () => {
  pingPositions.length = 0;
  currentPingIndex = -1;
};

addSystem({
  props: ["prefab", "modelScale"],
  onAdd: (e) => {
    if (e.prefab === "indicator") {
      indicators.set(e, {
        birth: appContext.current.lastUpdate,
        initialScale: e.modelScale,
      });

      // Track map pings (model: "location") for jump-to-ping feature
      if (e.model === "location" && e.position) {
        pingPositions.unshift({ x: e.position.x, y: e.position.y });
        if (pingPositions.length > MAX_PINGS) pingPositions.pop();
        currentPingIndex = -1; // Reset index when new ping arrives
      }
    }
  },
  onChange: (e) => {
    if (e.prefab !== "indicator") indicators.delete(e);
  },
  onRemove: (e) =>
    indicators.delete(e as SystemEntity<"prefab" | "modelScale">),
  update: (_, time) => {
    for (const [indicator, { birth, initialScale }] of indicators) {
      const next = initialScale - 9 * (time - birth) ** 2;
      if (next < 0.01) removeEntity(indicator);
      else {
        indicator.modelScale = next;
        // Rotate the indicator based on its scale
        indicator.facing = ((next - 0.01) / 0.99) ** 0.5 * Math.PI * 2 *
          (indicator.turnSpeed ?? 1);
      }
    }
  },
});

export const newIndicator = (
  position: { x: number; y: number },
  { color = "#33dd33", scale = 1, model = "circle" }: {
    color?: string;
    scale?: number;
    model?: "circle" | "gravity";
  } = {},
) => {
  addEntity({
    id: `indicator-${crypto.randomUUID()}`,
    prefab: "indicator",
    model,
    playerColor: color,
    position,
    modelScale: scale,
    isDoodad: true,
    isEffect: true,
    owner: getLocalPlayer()?.id,
  });
};
