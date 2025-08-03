import { addSystem } from "../ecs.ts";

addSystem({
  props: ["mana", "maxMana", "manaRegen"],
  updateEntity: (e, delta) => {
    // Only regenerate if we have mana regen rate and aren't at max mana
    if (e.manaRegen && e.mana < e.maxMana) {
      const newMana = Math.min(e.maxMana, e.mana + e.manaRegen * delta);
      e.mana = newMana;
    }
  },
});
