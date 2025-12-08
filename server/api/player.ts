import { lobbyContext } from "../contexts.ts";
import type { Client } from "../client.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { getPlayer } from "@/shared/api/player.ts";
import {
  deductTeamGold,
  getTeamGold,
  grantTeamGold,
  isTeamGoldEnabled,
  SHEEP_INDIVIDUAL_GOLD_CAP,
} from "./teamGold.ts";
import { spawnPracticeUnits } from "../st/gameStartHelpers.ts";

/**
 * Get the gold available to a player (considering team gold)
 * - Wolves: Returns team gold (individual gold is not used)
 * - Sheep: Returns individual gold + team gold
 */
export const getPlayerGold = (playerId: string): number => {
  const player = getPlayer(playerId);
  if (!player) return 0;

  const team = player.team === "wolf" || player.team === "sheep"
    ? player.team
    : undefined;
  if (!isTeamGoldEnabled(team)) {
    return player.gold ?? 0;
  }

  if (player.team === "wolf") {
    return getTeamGold("wolf");
  } else if (player.team === "sheep") {
    return (player.gold ?? 0) + getTeamGold("sheep");
  }

  return player.gold ?? 0;
};

/**
 * Deduct gold from a player, using team gold rules when enabled
 * - Wolves: Deduct from team pool
 * - Sheep: Deduct from team pool first, then individual gold
 */
export const deductPlayerGold = (playerId: string, amount: number) => {
  const player = getPlayer(playerId);
  if (!player) return;

  const team = player.team === "wolf" || player.team === "sheep"
    ? player.team
    : undefined;
  if (!isTeamGoldEnabled(team)) {
    if (player.gold !== undefined) {
      player.gold = Math.max(player.gold - amount, 0);
    }
    return;
  }

  if (player.team === "wolf") {
    deductTeamGold("wolf", amount);
  } else if (player.team === "sheep") {
    // Deduct from team pool first
    const deductedFromTeam = deductTeamGold("sheep", amount);
    const remaining = amount - deductedFromTeam;

    // Deduct remainder from individual gold
    if (remaining > 0 && player.gold !== undefined) {
      player.gold = Math.max(player.gold - remaining, 0);
    }
  } else if (player.gold !== undefined) {
    player.gold = Math.max(player.gold - amount, 0);
  }
};

/**
 * Grant gold to a player/team, using team gold rules when enabled
 * - Wolves: Grant to team pool
 * - Sheep: Fill individual gold up to cap, overflow to team pool
 */
export const grantPlayerGold = (playerId: string, amount: number) => {
  const player = getPlayer(playerId);
  if (!player) return;

  const team = player.team === "wolf" || player.team === "sheep"
    ? player.team
    : undefined;
  if (!isTeamGoldEnabled(team)) {
    player.gold = (player.gold ?? 0) + amount;
    return;
  }

  if (player.team === "wolf") {
    grantTeamGold("wolf", amount);
  } else if (player.team === "sheep") {
    const currentGold = player.gold ?? 0;
    const roomInIndividual = Math.max(
      0,
      SHEEP_INDIVIDUAL_GOLD_CAP - currentGold,
    );
    const toIndividual = Math.min(amount, roomInIndividual);
    const toTeam = amount - toIndividual;

    if (toIndividual > 0) {
      player.gold = currentGold + toIndividual;
    }
    if (toTeam > 0) {
      grantTeamGold("sheep", toTeam);
    }
  } else {
    player.gold = (player.gold ?? 0) + amount;
  }
};

export const sendPlayerGold = (
  senderId: string,
  recipientId: string,
  amount: number,
) => {
  const sender = getPlayer(senderId);
  if (!sender) return;

  amount = Math.min(sender.gold ?? 0, amount);

  const recipient = getPlayer(recipientId);
  if (!recipient) return;

  deductPlayerGold(senderId, amount);
  grantPlayerGold(recipientId, amount);
};

/**
 * Adds a player to an ongoing practice game
 * Creates player entity and spawns units
 * @param client The client to add to the practice game
 */
export const addPlayerToPracticeGame = (client: Client) => {
  const lobby = lobbyContext.current;
  if (!lobby?.round?.practice) return;

  // Don't add if player already has a team (already in game)
  if (client.team !== "pending") return;

  // Set client properties for practice game
  client.team = "sheep";
  client.gold = 100_000;

  // Add client to ECS
  addEntity(client);

  spawnPracticeUnits(client.id);
};
