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
import { addChatMessage } from "@/vars/chat.ts";
import { stateVar } from "@/vars/state.ts";

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
 * Displays a message indicating the current zoom level.
 * Skips the message if not in a game.
 */
export const showZoomMessage = () => {
  if (stateVar() !== "playing") return;

  const zoom = camera.position.z;
  const settings = gameplaySettingsVar();
  const labels = [];

  if (zoom === settings.sheepZoom) labels.push("sheep");
  if (zoom === settings.wolfZoom) labels.push("wolf");
  if (zoom === settings.spiritZoom) labels.push("spirit");

  const labelText = labels.length ? ` (${labels.join(", ")})` : "";

  addChatMessage(`Zoom set to ${zoom}${labelText}.`);
};

/**
 * Sets camera zoom and optionally displays a message.
 * Skips if the zoom level didn't change.
 */
export const setZoom = (zoom: number, silent = false) => {
  if (camera.position.z === zoom) return;

  camera.position.z = zoom;

  if (!silent) showZoomMessage();
};

/**
 * Applies the appropriate zoom level based on the local player's state.
 * Priority:
 * 1. If player has a primary unit (sheep/wolf/spirit), use that unit's zoom
 * 2. If player is on a team, use that team's zoom
 * 3. Otherwise, use spirit zoom (spectator/observer)
 */
export const applyZoom = (silent = false) => {
  const settings = gameplaySettingsVar();
  const localPlayer = getLocalPlayer();
  const primaryUnit = primaryUnitVar();

  if (localPlayer && primaryUnit && primaryUnit.owner === localPlayer.id) {
    if (primaryUnit.prefab === "sheep") {
      setZoom(settings.sheepZoom, silent);
    } else if (primaryUnit.prefab === "wolf") {
      setZoom(settings.wolfZoom, silent);
    } else if (primaryUnit.prefab === "spirit") {
      setZoom(settings.spiritZoom, silent);
    }
  } else if (localPlayer?.team === "sheep") {
    setZoom(settings.sheepZoom, silent);
  } else if (localPlayer?.team === "wolf") {
    setZoom(settings.wolfZoom, silent);
  } else {
    // Spectator/observer or no team assigned (or no local player yet)
    setZoom(settings.spiritZoom, silent);
  }
};

// Apply zoom on initial load (silent)
onInit(() => applyZoom(true));

const TEAM_ENTITY_IDS = {
  sheep: "team-sheep",
  wolf: "team-wolf",
} as const;

/**
 * Check if team gold is enabled for the current game
 * @param team - Optional team to check. In vamp mode, wolves have team gold but sheep don't.
 */
export const isTeamGoldEnabled = (team?: "sheep" | "wolf"): boolean => {
  const settings = lobbySettingsVar();
  if (settings.mode === "vip") return true;
  if (settings.mode === "vamp") return team === "wolf";
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

  const team = player.team === "wolf" || player.team === "sheep"
    ? player.team
    : undefined;
  if (!isTeamGoldEnabled(team)) {
    return player.gold ?? 0;
  }

  const teamEntityId = team ? TEAM_ENTITY_IDS[team] : undefined;
  const teamEntity = teamEntityId ? lookup(teamEntityId) : undefined;
  const teamGold = teamEntity?.gold ?? 0;

  if (player.team === "wolf") {
    return teamGold;
  } else if (player.team === "sheep") {
    return (player.gold ?? 0) + teamGold;
  }

  return player.gold ?? 0;
};
