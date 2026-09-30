import { Player, playerEntities } from "@/shared/api/player.ts";
import { useMemo } from "react";
import type { Entity } from "../../ecs.ts";
import { useSet } from "./useSet.ts";
import { useListenToEntities } from "./useListenToEntityProp.ts";
import { useReactiveVar } from "./useVar.tsx";
import { localPlayerIdVar } from "@/vars/localPlayerId.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";

const isRealPlayer = (player: Player) => player.id !== "practice-enemy";

/**
 * Returns all player entities from the ECS, excluding synthetic players like
 * "practice-enemy". Rerenders when players are added or removed, and when any
 * of the given props change on a player.
 */
export const usePlayers = (
  props: (keyof Entity)[] = [],
): readonly Player[] => {
  const set = playerEntities();
  const version = useSet(set);
  const players = useMemo(() => set.filterToArray(isRealPlayer), [
    set,
    version,
  ]);
  useListenToEntities(players, props);
  return players;
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
