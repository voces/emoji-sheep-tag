import { lobbyContext } from "../contexts.ts";

/**
 * Gets a player entity by their ID
 * @param playerId The player's ID
 * @returns The player entity or undefined if not found
 */
export const getPlayer = (playerId: string) => {
  const lobby = lobbyContext.current;
  if (!lobby?.round) return undefined;

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
