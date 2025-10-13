import { camera } from "../graphics/three.ts";
import { gameplaySettingsVar } from "@/vars/gameplaySettings.ts";
import { getLocalPlayer } from "@/vars/players.ts";
import { data } from "../data.ts";
import { getPrimaryUnit } from "../systems/autoSelect.ts";

/**
 * Applies the appropriate zoom level based on the local player's state.
 * Priority:
 * 1. If player has a primary unit (sheep/wolf/spirit), use that unit's zoom
 * 2. If player is on a team, use that team's zoom
 * 3. Otherwise, use spirit zoom (spectator/observer)
 */
export const applyZoom = () => {
  const settings = gameplaySettingsVar();
  const localPlayer = getLocalPlayer();

  // Try to get primary unit, but handle case where module isn't loaded yet
  let primaryUnit;
  try {
    primaryUnit = getPrimaryUnit();
  } catch {
    // getPrimaryUnit not available yet during initialization
  }

  if (localPlayer && primaryUnit && primaryUnit.owner === localPlayer.id) {
    if (primaryUnit.prefab === "sheep") {
      camera.position.z = settings.sheepZoom;
    } else if (primaryUnit.prefab === "wolf") {
      camera.position.z = settings.wolfZoom;
    } else if (primaryUnit.prefab === "spirit") {
      camera.position.z = settings.spiritZoom;
    }
  } else if (data.sheep.some((p) => p.local)) {
    camera.position.z = settings.sheepZoom;
  } else if (data.wolves.some((p) => p.local)) {
    camera.position.z = settings.wolfZoom;
  } else {
    // Spectator/observer or no team assigned (or no local player yet)
    camera.position.z = settings.spiritZoom;
  }
};

// Apply zoom on initial load (safe because we handle getPrimaryUnit not being ready)
applyZoom();
