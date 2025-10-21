import { lobbyContext } from "../contexts.ts";
import { newUnit } from "./unit.ts";
import { getSheepSpawn, getSpiritSpawn } from "../st/getSheepSpawn.ts";
import { center } from "@/shared/map.ts";
import type { Client } from "../client.ts";
import { addEntity } from "@/shared/api/entity.ts";

/**
 * Gets a player entity by their ID
 * @param playerId The player's ID
 * @returns The player entity or undefined if not found
 */
export const getPlayer = (playerId: string | undefined) => {
  if (!playerId) return;

  const lobby = lobbyContext.current;
  if (!lobby?.round) return;

  return Array.from([...lobby.round.sheep, ...lobby.round.wolves])
    .find((client) => client.id === playerId)?.playerEntity;
};

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
  const wolf = newUnit(playerId, "wolf", center.x, center.y);
  if (wolf.manaRegen) wolf.manaRegen *= 10;
  return sheep;
};

/**
 * Adds a player to an ongoing practice game
 * Creates player entity and spawns units
 * @param client The client to add to the practice game
 */
export const addPlayerToPracticeGame = (client: Client) => {
  const lobby = lobbyContext.current;
  if (!lobby?.round?.practice || client.playerEntity) return;

  client.playerEntity = addEntity({
    name: client.name,
    owner: client.id,
    playerColor: client.color,
    isPlayer: true,
    team: "sheep",
    gold: 100_000,
  });

  lobby.round.sheep.add(client);

  spawnPracticeUnits(client.id);
};
