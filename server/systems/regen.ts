import { addSystem } from "@/shared/context.ts";
import { iterateBuffs } from "@/shared/api/unit.ts";

addSystem({
  props: ["mana", "maxMana", "manaRegen"],
  updateEntity: (e, delta) => {
    e.mana = Math.max(
      Math.min(e.maxMana, e.mana + e.manaRegen * delta),
      0,
    );
  },
});

addSystem({
  props: ["health", "maxHealth", "healthRegen"],
  updateEntity: (e, delta) => {
    if (e.health <= 0) return;

    // Calculate total health regen including buff bonuses (from direct buffs and item buffs)
    let totalHealthRegen = e.healthRegen;
    for (const buff of iterateBuffs(e)) {
      if (buff.healthRegen) {
        totalHealthRegen += buff.healthRegen;
      }
    }

    e.health = Math.max(
      Math.min(e.maxHealth, e.health + totalHealthRegen * delta),
      0,
    );
  },
});
