import { lobbyContext } from "../contexts.ts";

/**
 * Gets the gold amount for a player by their ID
 * @param playerId The player's ID
 * @returns The player's gold amount, or 0 if not found
 */
export const getPlayerGold = (playerId: string): number => {
  const lobby = lobbyContext.context;
  if (!lobby?.round) return 0;

  // Find the client in either sheep or wolves
  const client = Array.from([...lobby.round.sheep, ...lobby.round.wolves])
    .find((client) => client.id === playerId);

  return client?.playerEntity?.gold ?? 0;
};

/**
 * Deducts gold from a player's entity
 * @param playerId The player's ID
 * @param amount The amount of gold to deduct
 */
export const deductPlayerGold = (playerId: string, amount: number) => {
  if (amount <= 0) return;

  const lobby = lobbyContext.context;
  const ownerClient = lobby?.round
    ? Array.from([...lobby.round.sheep, ...lobby.round.wolves]).find(
      (client) => client.id === playerId,
    )
    : undefined;

  if (
    ownerClient?.playerEntity && ownerClient.playerEntity.gold !== undefined
  ) ownerClient.playerEntity.gold -= amount;
};
