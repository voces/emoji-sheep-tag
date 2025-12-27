import { Player, playerEntities } from "@/shared/api/player.ts";
import { useSet } from "./useSet.ts";
import { useReactiveVar } from "./useVar.tsx";
import { localPlayerIdVar } from "@/vars/localPlayerId.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";

/**
 * React hook that returns all player entities from the ECS.
 * Automatically updates when players are added, removed, or their properties change.
 * Filters out synthetic players like "practice-enemy".
 */
export const usePlayers = (): readonly Player[] => {
  // Use the useSet hook to listen for changes to the player entities set
  useSet(playerEntities());
  // TODO: register player props we need to be reactive
  // useListenToEntities(playerEntities, [''])

  // Return the current player entities as an array, filtering out practice-enemy
  return (Array.from(playerEntities()) as Player[]).filter((p) =>
    p.id !== "practice-enemy"
  );
};

/**
 * Returns the local player entity, if any.
 */
export const useLocalPlayer = (): Player | undefined => {
  const players = usePlayers();
  const localPlayerId = useReactiveVar(localPlayerIdVar);
  return players.find((p) => p.id === localPlayerId);
};

/**
 * Returns if the local player is the lobby host.
 */
export const useIsLocalPlayerHost = (): boolean => {
  const localPlayerId = useReactiveVar(localPlayerIdVar);
  const lobbySettings = useReactiveVar(lobbySettingsVar);
  return !!localPlayerId && localPlayerId === lobbySettings.host;
};

/**
 * Returns a specific player by ID.
 */
export const usePlayer = (playerId: string | undefined): Player | undefined => {
  const players = usePlayers();
  return playerId ? players.find((p) => p.id === playerId) : undefined;
};
