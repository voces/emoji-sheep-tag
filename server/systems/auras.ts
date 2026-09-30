import { App } from "@verit/ecs";
import { addSystem } from "@/shared/context.ts";
import { getEntitiesInRange } from "@/shared/systems/kd.ts";
import { buffs } from "@/shared/data.ts";
import { iterateBuffs, testClassification } from "@/shared/api/unit.ts";
import { lookup } from "./lookup.ts";
import type { Entity } from "@/shared/types.ts";

const AURA_LINGER = 2;

type AuraState = {
  /** `${sourceId}-${auraBuffId}` -> ids of targets the aura is applied to */
  applications: Map<string, Set<string>>;
  processedThisTick: Set<Entity>;
};

const states = new WeakMap<App<Entity>, AuraState>();

const getState = (app: App<Entity>) => {
  let state = states.get(app);
  if (!state) {
    state = { applications: new Map(), processedThisTick: new Set() };
    states.set(app, state);
  }
  return state;
};

/** Starts the linger countdown on a target's aura buff, unless it is already counting down */
const lingerAura = (targetId: string, auraBuffId: string) => {
  const target = lookup(targetId);
  if (!target?.buffs) return;
  const index = target.buffs.findIndex((b) => b.auraBuff === auraBuffId);
  if (index < 0 || target.buffs[index].remainingDuration !== undefined) return;
  target.buffs = target.buffs.with(index, {
    ...target.buffs[index],
    remainingDuration: AURA_LINGER,
  });
};

const updateAuras = (state: AuraState, entity: Entity) => {
  if (!entity.position || state.processedThisTick.has(entity)) return;
  state.processedThisTick.add(entity);

  for (const auraBuff of iterateBuffs(entity)) {
    if (!auraBuff.radius || !auraBuff.auraBuff) continue;

    const buffDefinition = buffs[auraBuff.auraBuff];
    if (!buffDefinition) continue;

    const auraKey = `${entity.id}-${auraBuff.auraBuff}`;
    const targetsInRange = new Set<string>();

    const nearbyEntities = getEntitiesInRange(
      entity.position.x,
      entity.position.y,
      auraBuff.radius,
    );

    for (const target of nearbyEntities) {
      if (target.id === entity.id || !target.position) continue;
      if (!auraBuff.targetsAllowed) continue;
      if (!testClassification(entity, target, auraBuff.targetsAllowed)) {
        continue;
      }

      targetsInRange.add(target.id);

      const existingIndex = target.buffs?.findIndex((b) =>
        b.auraBuff === auraBuff.auraBuff
      );

      if (existingIndex !== undefined && existingIndex >= 0) {
        // Back in range: drop the linger countdown, leaving an unchanged buff untouched
        const { remainingDuration, ...buffWithoutDuration } =
          target.buffs![existingIndex];
        if (remainingDuration !== undefined) {
          target.buffs = target.buffs!.with(existingIndex, buffWithoutDuration);
        }
      } else {
        target.buffs = [...target.buffs ?? [], {
          ...buffDefinition,
          auraBuff: auraBuff.auraBuff,
        }];
      }
    }

    for (const targetId of state.applications.get(auraKey) ?? []) {
      if (!targetsInRange.has(targetId)) {
        lingerAura(targetId, auraBuff.auraBuff);
      }
    }

    state.applications.set(auraKey, targetsInRange);
  }
};

const removeAuras = (state: AuraState, entity: Entity) => {
  for (const auraBuff of iterateBuffs(entity)) {
    if (!auraBuff.radius || !auraBuff.auraBuff) continue;

    const auraKey = `${entity.id}-${auraBuff.auraBuff}`;
    const targets = state.applications.get(auraKey);
    if (!targets) continue;

    for (const targetId of targets) lingerAura(targetId, auraBuff.auraBuff);
    state.applications.delete(auraKey);
  }
};

// Entities with both buffs and inventory are in both systems; updateAuras
// processes each entity once per tick
addSystem((app) => {
  const state = getState(app);
  return {
    props: ["buffs"] as const,
    update: () => state.processedThisTick.clear(),
    updateEntity: (entity) => updateAuras(state, entity),
    onRemove: (entity) => removeAuras(state, entity),
  };
});

addSystem((app) => {
  const state = getState(app);
  return {
    props: ["inventory"] as const,
    updateEntity: (entity) => updateAuras(state, entity),
    onRemove: (entity) => removeAuras(state, entity),
  };
});
