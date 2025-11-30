import { lobbyContext } from "../contexts.ts";
import { lookup } from "../systems/lookup.ts";
import type { Entity } from "@/shared/types.ts";

/** Maximum individual gold a sheep can hold before overflow goes to team pool */
export const SHEEP_INDIVIDUAL_GOLD_CAP = 20;

const TEAM_ENTITY_IDS = {
  sheep: "team-sheep",
  wolf: "team-wolf",
} as const;

/**
 * Check if team gold is enabled for the current game
 */
export const isTeamGoldEnabled = (): boolean => {
  const lobby = lobbyContext.current;
  if (lobby.round?.practice) return false;
  if (lobby.settings.mode === "vip") return true;
  return lobby.settings.mode === "survival" && lobby.settings.teamGold;
};

/**
 * Get the team entity for a given team
 */
export const getTeamEntity = (
  team: "sheep" | "wolf",
): Entity | undefined => lookup(TEAM_ENTITY_IDS[team]);

/**
 * Get the team gold amount for a given team
 */
export const getTeamGold = (team: "sheep" | "wolf"): number => {
  const teamEntity = getTeamEntity(team);
  return teamEntity?.gold ?? 0;
};

/**
 * Grant gold to a team's pool
 */
export const grantTeamGold = (team: "sheep" | "wolf", amount: number) => {
  const teamEntity = getTeamEntity(team);
  if (teamEntity) {
    teamEntity.gold = (teamEntity.gold ?? 0) + amount;
  }
};

/**
 * Deduct gold from a team's pool
 * Returns the amount actually deducted (may be less if insufficient funds)
 */
export const deductTeamGold = (
  team: "sheep" | "wolf",
  amount: number,
): number => {
  const teamEntity = getTeamEntity(team);
  if (!teamEntity || !teamEntity.gold) return 0;

  const deducted = Math.min(teamEntity.gold, amount);
  teamEntity.gold = teamEntity.gold - deducted;
  return deducted;
};
