import { addSystem } from "@/shared/context.ts";

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
    if (e.health < 0) return;
    e.lastAttacker = null;
    e.health = Math.max(
      Math.min(e.maxHealth, e.health + e.healthRegen * delta),
      0,
    );
  },
});
