import {
  Buff,
  Entity,
  OrderEffect,
  Placement,
  SystemEntity,
} from "@/shared/types.ts";
import { Point } from "@/shared/pathing/math.ts";
import { DEFAULT_FACING } from "@/shared/constants.ts";
import { testClassification } from "@/shared/api/unit.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { getEntitiesInRange } from "@/shared/systems/kd.ts";
import { damageEntity, newUnit, refundEntity } from "../api/unit.ts";
import { pathingMap } from "../systems/pathing.ts";
import { lookup } from "../systems/lookup.ts";
import { newSfx } from "../api/sfx.ts";

/** The resolved target of an order: an entity, a ground point, or nothing. */
export type EffectTarget = Entity | Point | undefined;

const isPoint = (t: EffectTarget): t is Point =>
  !!t && "x" in t && !("id" in t);

const targetEntity = (t: EffectTarget): Entity | undefined =>
  t && !isPoint(t) ? t : undefined;

const targetPoint = (t: EffectTarget): Point | undefined =>
  !t ? undefined : isPoint(t) ? t : t.position;

/** Resolves the effect target from a unit's active cast order. */
export const resolveOrderTarget = (unit: Entity): EffectTarget => {
  if (unit.order?.type !== "cast") return undefined;
  if (unit.order.targetId) return lookup(unit.order.targetId);
  return unit.order.target;
};

const addOrReplaceBuff = (
  entity: Entity,
  buff: Buff,
  replaceByName?: boolean,
) => {
  if (replaceByName && buff.name) {
    const existing = entity.buffs?.findIndex((b) => b.name === buff.name) ?? -1;
    if (existing >= 0) {
      entity.buffs = entity.buffs!.map((b, i) => (i === existing ? buff : b));
      return;
    }
  }
  entity.buffs = [...(entity.buffs ?? []), buff];
};

const resolveSpawnPosition = (
  caster: Entity,
  spawned: SystemEntity<"position" | "radius">,
  placement: Placement,
  target: EffectTarget,
): { x: number; y: number; facing?: number } | undefined => {
  const p = pathingMap();

  if (placement.kind === "atTarget") {
    const pt = targetPoint(target);
    return pt ? { x: pt.x, y: pt.y } : undefined;
  }

  if (!caster.position) return undefined;

  const angle = caster.facing ?? DEFAULT_FACING;
  const layer = p.layer(caster.position.x, caster.position.y);
  const pos1 = p.nearestSpiralPathing(
    caster.position.x + Math.cos(angle) * placement.distance,
    caster.position.y + Math.sin(angle) * placement.distance,
    spawned,
  );
  return {
    ...p.nearestSpiralPathing(pos1.x, pos1.y, spawned, layer),
    facing: angle,
  };
};

const applyEffect = (
  caster: Entity,
  target: EffectTarget,
  effect: OrderEffect,
) => {
  switch (effect.type) {
    case "applyBuff": {
      const dest = effect.to === "self" ? caster : targetEntity(target);
      if (dest) addOrReplaceBuff(dest, effect.buff, effect.replaceByName);
      break;
    }

    case "spawn": {
      if (!caster.owner) break;
      const count = effect.count ?? 1;
      for (let i = 0; i < count; i++) {
        const spawned = newUnit(
          caster.owner,
          effect.prefab,
          Infinity,
          Infinity,
        );
        const placed = resolveSpawnPosition(
          caster,
          spawned as SystemEntity<"position" | "radius">,
          effect.placement,
          target,
        );
        if (placed) {
          spawned.position = { x: placed.x, y: placed.y };
          if (placed.facing !== undefined) spawned.facing = placed.facing;
        }
        if (effect.lifetime) {
          spawned.buffs = [
            ...(spawned.buffs ?? []),
            {
              remainingDuration: effect.lifetime,
              totalDuration: effect.lifetime,
              expiration: effect.prefab,
            },
          ];
        }
        if (effect.inheritColor && caster.trueOwner) {
          spawned.trueOwner = caster.trueOwner;
          const playerColor = getPlayer(caster.trueOwner)?.playerColor;
          if (playerColor) spawned.playerColor = playerColor;
        }
      }
      break;
    }

    case "damage": {
      if (effect.aoe) {
        const pt = targetPoint(target);
        if (!pt) break;
        for (const e of getEntitiesInRange(pt.x, pt.y, effect.aoe)) {
          if (
            effect.targeting && !testClassification(caster, e, effect.targeting)
          ) {
            continue;
          }
          damageEntity(caster, e, effect.amount, false);
        }
      } else {
        const dest = targetEntity(target);
        if (dest) damageEntity(caster, dest, effect.amount, false);
      }
      break;
    }

    case "restoreMana": {
      if (
        typeof caster.mana === "number" && typeof caster.maxMana === "number"
      ) {
        caster.mana = Math.min(caster.mana + effect.amount, caster.maxMana);
      }
      break;
    }

    case "removeSelf": {
      if (effect.refund) refundEntity(caster);
      caster.lastAttacker = null;
      if (typeof caster.health === "number") caster.health = 0;
      break;
    }

    case "sfx": {
      const pt = effect.at === "target" ? targetPoint(target) : caster.position;
      if (!pt) break;
      newSfx(
        pt,
        effect.model,
        effect.facing ?? DEFAULT_FACING,
        effect.duration ?? 1,
        undefined,
        undefined,
        {
          ...(effect.sound ? { sounds: { birth: [effect.sound] } } : {}),
          ...(caster.owner ? { owner: caster.owner } : {}),
        },
      );
      break;
    }
  }
};

/** Applies a list of order effects to the caster, resolving "target" effects against `target`. */
export const applyOrderEffects = (
  caster: Entity,
  target: EffectTarget,
  effects: ReadonlyArray<OrderEffect>,
) => {
  for (const effect of effects) applyEffect(caster, target, effect);
};
