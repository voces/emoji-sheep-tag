import { lobbyContext } from "../contexts.ts";
import { newUnit } from "./unit.ts";
import { getSheepSpawn, getSpiritSpawn } from "../st/getSheepSpawn.ts";
import { getMapCenter } from "@/shared/map.ts";
import type { Client } from "../client.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { practiceModeActions } from "@/shared/data.ts";

/**
 * Gets the gold amount for a player by their ID
 * @param playerId The player's ID
 * @returns The player's gold amount, or 0 if not found
 */
export const getPlayerGold = (playerId: string): number => {
  const player = getPlayer(playerId);
  return player?.gold ?? 0;
};

/**
 * Deducts gold from a player's entity
 * @param playerId The player's ID
 * @param amount The amount of gold to deduct
 */
export const deductPlayerGold = (playerId: string, amount: number) => {
  const player = getPlayer(playerId);
  if (player?.gold !== undefined) {
    player.gold = Math.max(player.gold - amount, 0);
  }
};

/**
 * Grants gold to a player's entity
 * @param playerId The player's ID
 * @param amount The amount of gold to grant
 */
export const grantPlayerGold = (playerId: string, amount: number) => {
  const player = getPlayer(playerId);
  if (!player) return;

  player.gold = Math.max((player.gold ?? 0) + amount, 0);
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
 * Spawns practice mode units for a player (sheep, spirit, and wolf)
 * @param playerId The player's ID
 */
export const spawnPracticeUnits = (playerId: string) => {
  const sheep = newUnit(playerId, "sheep", ...getSheepSpawn());
  newUnit(playerId, "spirit", ...getSpiritSpawn());
  const { x, y } = getMapCenter();
  const wolf = newUnit(playerId, "wolf", x, y);
  if (wolf.manaRegen) wolf.manaRegen *= 10;

  // Set trueOwner so the player retains control even when transferring ownership
  wolf.trueOwner = playerId;

  // Add practice mode "Give to Enemy" action (will be swapped to "Reclaim" when given)
  if (wolf.actions) {
    wolf.actions = [
      ...wolf.actions,
      practiceModeActions.giveToEnemy,
    ];
  }

  return sheep;
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
