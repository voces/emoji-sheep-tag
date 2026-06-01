import { OrderOverride } from "./types.ts";

export const manaPotionOrder = {
  // Don't waste the potion when already at full mana; the restore + sparkle are
  // expressed as data effects (restoreMana + custom "manaSparkle").
  canExecute: (unit) =>
    !(typeof unit.mana === "number" && typeof unit.maxMana === "number" &&
      unit.mana >= unit.maxMana),
} satisfies OrderOverride;
