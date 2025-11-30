import { camera } from "../graphics/three.ts";
import { gameplaySettingsVar } from "@/vars/gameplaySettings.ts";
import { getPlayer, getPlayers, Player } from "@/shared/api/player.ts";
import { localPlayerIdVar } from "@/vars/localPlayerId.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
// Import triggers module resolution order that prevents circular dependency issues
import "../systems/selection.ts";
import { primaryUnitVar } from "@/vars/primaryUnit.ts";
import { onInit } from "@/shared/context.ts";
import { lookup } from "../systems/lookup.ts";

export const getLocalPlayer = (): Player | undefined =>
  getPlayers().find((p) => p.id === localPlayerIdVar());

export const isLocalPlayerHost = () =>
  getLocalPlayer()?.id === lobbySettingsVar().host;

export const isLocalPlayer = (player: Player | string): boolean => {
  const localPlayerId = getLocalPlayer()?.id;
  return localPlayerId
    ? localPlayerId === (typeof player === "string" ? player : player.id)
    : false;
};

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
  const primaryUnit = primaryUnitVar();

  if (localPlayer && primaryUnit && primaryUnit.owner === localPlayer.id) {
    if (primaryUnit.prefab === "sheep") {
      camera.position.z = settings.sheepZoom;
    } else if (primaryUnit.prefab === "wolf") {
      camera.position.z = settings.wolfZoom;
    } else if (primaryUnit.prefab === "spirit") {
      camera.position.z = settings.spiritZoom;
    }
  } else if (localPlayer?.team === "sheep") {
    camera.position.z = settings.sheepZoom;
  } else if (localPlayer?.team === "wolf") {
    camera.position.z = settings.wolfZoom;
  } else {
    // Spectator/observer or no team assigned (or no local player yet)
    camera.position.z = settings.spiritZoom;
  }
};

// Apply zoom on initial load
onInit(applyZoom);

const TEAM_ENTITY_IDS = {
  sheep: "team-sheep",
  wolf: "team-wolf",
} as const;

/**
 * Check if team gold is enabled for the current game
 */
export const isTeamGoldEnabled = (): boolean => {
  const settings = lobbySettingsVar();
  if (settings.mode === "vip") return true;
  return settings.mode === "survival" && settings.teamGold;
};

/**
 * Get the effective gold available to a player (considering team gold)
 * - Wolves: Returns team gold (individual gold is not used)
 * - Sheep: Returns individual gold + team gold
 */
export const getEffectivePlayerGold = (
  playerId: string | undefined,
): number => {
  if (!playerId) return 0;

  const player = getPlayer(playerId);
  if (!player) return 0;

  if (!isTeamGoldEnabled()) {
    return player.gold ?? 0;
  }

  const teamEntityId = (player.team === "sheep" || player.team === "wolf")
    ? TEAM_ENTITY_IDS[player.team]
    : undefined;
  const teamEntity = teamEntityId ? lookup[teamEntityId] : undefined;
  const teamGold = teamEntity?.gold ?? 0;

  if (player.team === "wolf") {
    return teamGold;
  } else if (player.team === "sheep") {
    return (player.gold ?? 0) + teamGold;
  }

  return player.gold ?? 0;
};
