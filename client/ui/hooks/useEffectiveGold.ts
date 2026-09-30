import { getPlayer } from "@/shared/api/player.ts";
import type { Entity } from "../../ecs.ts";
import {
  getEffectivePlayerGold,
  getTeamEntity,
  isTeamGoldEnabled,
  toGoldTeam,
} from "../../api/player.ts";
import { useListenToEntityProps } from "./useListenToEntityProp.ts";

const floorGold = ({ gold }: Pick<Entity, "gold">) => Math.floor(gold ?? 0);

/**
 * Returns the gold a player can spend, including team gold. While `listen` is
 * set, rerenders when the whole-gold value of the player or their team changes.
 */
export const useEffectiveGold = (
  playerId: string | undefined,
  listen = true,
) => {
  const player = listen ? getPlayer(playerId) : undefined;
  const team = toGoldTeam(player?.team);
  useListenToEntityProps(player, ["gold"], floorGold);
  useListenToEntityProps(
    isTeamGoldEnabled(team) ? getTeamEntity(team) : undefined,
    ["gold"],
    floorGold,
  );
  return getEffectivePlayerGold(playerId);
};
