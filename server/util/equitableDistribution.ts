/**
 * Distributes an amount equitably among recipients to equalize their final totals.
 * The goal is to bring everyone as close as possible to having the same total gold.
 * Priority is given to those with less gold.
 *
 * @param totalAmount - The total amount to distribute
 * @param currentGold - Array of current gold amounts for each recipient
 * @returns Array of shares for each recipient
 *
 * @example
 * // Equalize distribution - bring everyone to same level
 * distributeEquitably(90, [50, 30, 20])
 * // Total gold = 100, adding 90 = 190 total
 * // Target per person = 190/3 = 63.33
 * // Returns [13, 33, 44] -> final amounts [63, 63, 64]
 *
 * @example
 * // Equal distribution when all have same gold
 * distributeEquitably(100, [50, 50])
 * // Returns [50, 50]
 *
 * @example
 * // When one person has excess, only fill up the others
 * distributeEquitably(120, [100, 10, 10])
 * // Target = 76.67, but we can only give to those below it
 * // Give 60 each to the two poor players (120 total)
 * // Returns [0, 60, 60] -> final amounts [100, 70, 70]
 */
export const distributeEquitably = (
  totalAmount: number,
  currentGold: number[],
): number[] => {
  if (currentGold.length === 0) return [];
  if (totalAmount === 0) return currentGold.map(() => 0);

  let remaining = totalAmount;
  const shares = currentGold.map(() => 0);

  // Keep raising the target level until we've distributed everything
  const sorted = currentGold
    .map((gold, index) => ({ gold, index }))
    .sort((a, b) => a.gold - b.gold);

  for (let i = 0; i < sorted.length && remaining > 0; i++) {
    // How many people are at or below this level (including this person)?
    const recipientsAtThisLevel = i + 1;

    // Calculate target to bring everyone up to the next person's level
    // (or distribute all remaining if this is the last person)
    const currentLevel = sorted[i].gold + shares[sorted[i].index];
    const nextLevel = i < sorted.length - 1
      ? sorted[i + 1].gold
      : currentLevel + remaining;

    // How much would it cost to bring everyone below/at this level up to nextLevel?
    let cost = 0;
    for (let j = 0; j <= i; j++) {
      const currentAmount = sorted[j].gold + shares[sorted[j].index];
      cost += nextLevel - currentAmount;
    }

    if (cost <= remaining) {
      // We can afford to bring everyone up to this level
      for (let j = 0; j <= i; j++) {
        const currentAmount = sorted[j].gold + shares[sorted[j].index];
        shares[sorted[j].index] += nextLevel - currentAmount;
      }
      remaining -= cost;
    } else {
      // Distribute remaining evenly among those at/below this level
      const perPerson = remaining / recipientsAtThisLevel;

      for (let j = 0; j <= i; j++) {
        shares[sorted[j].index] += perPerson;
      }
      remaining = 0;
    }
  }

  return shares;
};
