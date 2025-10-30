import {
  isEnemy,
  iterateBuffs,
  tempUnit,
  testClassification,
} from "@/shared/api/unit.ts";
import {
  canSwing,
  distanceBetweenPoints,
  Point,
} from "@/shared/pathing/math.ts";
import { isPathingEntity } from "@/shared/pathing/util.ts";
import { Entity, Item, Order, SystemEntity } from "@/shared/types.ts";
import {
  calcPath,
  pathable,
  pathingMap,
  updatePathing,
  withPathingMap,
} from "../systems/pathing.ts";
import { buffs, items, prefabs } from "@/shared/data.ts";
import { findAction } from "../util/actionLookup.ts";
import { BUILD_REFUND_RATE, FOLLOW_DISTANCE } from "@/shared/constants.ts";
import { getEntitiesInRange } from "../systems/kd.ts";
import {
  deductPlayerGold,
  getPlayer,
  getPlayerGold,
  grantPlayerGold,
} from "./player.ts";
import { addEntity, mergeEntityWithPrefab } from "@/shared/api/entity.ts";
import { appContext } from "@/shared/context.ts";
import { playSoundAt } from "./sound.ts";
import { newSfx } from "./sfx.ts";

const INITIAL_BUILDING_PROGRESS = 0.1;

export const build = (builder: Entity, type: string, x: number, y: number) => {
  const app = appContext.current;
  if (
    !isPathingEntity(builder) ||
    (builder.owner &&
      getBuildGoldCost(builder, type) > getPlayerGold(builder.owner))
  ) return;

  const p = pathingMap();

  const goldCost = findAction(
    builder,
    (a) => a.type === "build" && a.unitType === type,
  )?.goldCost;

  // Get handicap from owner's player entity
  const ownerEntity = getPlayer(builder.owner);

  const temp = tempUnit(
    builder.owner!,
    type,
    x,
    y,
    {
      gold: goldCost ? goldCost * BUILD_REFUND_RATE : undefined,
      progress: prefabs[type].completionTime
        ? INITIAL_BUILDING_PROGRESS
        : undefined,
      handicap: ownerEntity?.handicap,
    },
  );

  if (!isPathingEntity(temp)) {
    deductBuildGold(builder, type);
    return p.withoutEntity(builder, () => app.addEntity(temp));
  }

  // Make building if pathable
  const pathable = p.withoutEntity(builder, () => {
    if (!p.pathable(temp)) return false;
    deductBuildGold(builder, type);
    app.addEntity(temp);
    return true;
  });
  if (!pathable) return;

  // Handle translocation for Translocation Hut
  if (type === "translocationHut" && builder.position && temp.position) {
    // Play poof sound at sheep's start position
    playSoundAt(builder.position, "poof1");

    // Calculate the vector from structure center to builder
    const dx = builder.position.x - temp.position.x;
    const dy = builder.position.y - temp.position.y;

    // Convert to polar coordinates and add 180 degrees
    const distance = Math.max(Math.sqrt(dx * dx + dy * dy) * 1.5, 1);
    const angle = Math.atan2(dy, dx) + Math.PI; // Add 180 degrees (π radians)

    // Calculate new position on opposite side
    const layer = p.layer(builder.position.x, builder.position.y);
    const { x: newX, y: newY } = p.nearestSpiralPathing(
      temp.position.x + distance * Math.cos(angle),
      temp.position.y + distance * Math.sin(angle),
      builder,
      layer,
    );

    // Calculate facing for dash SFX (movement direction)
    const dashFacing = Math.atan2(
      newY - builder.position.y,
      newX - builder.position.x,
    );

    // Create dash SFX at start position
    newSfx(builder.position, "dash", dashFacing, 0.3, "ease-out");

    // Move the builder to the new position
    builder.position = { x: newX, y: newY };
  }

  // Relocate entity if position not valid
  app.enqueue(() => {
    updatePathing(builder);

    if (type === "translocationHut" && builder.position) {
      playSoundAt(builder.position, "poof1");

      // Create dash SFX at end position (facing is same as movement direction)
      const startPos = temp.position;
      if (startPos) {
        const dashFacing = Math.atan2(
          startPos.y - builder.position.y,
          startPos.x - builder.position.x,
        );
        newSfx(builder.position, "dash", dashFacing, 0.3, "ease-out");
      }
    }
  });

  return temp;
};

export const newUnit = (
  owner: string,
  type: string,
  x: number,
  y: number,
  extra?: Partial<Entity>,
) => addEntity(tempUnit(owner, type, x, y, extra));

const processOrder = (entity: Entity, order: Order, queue: boolean) => {
  if (queue) entity.queue = [...entity.queue ?? [], order];
  else {
    delete entity.queue;
    entity.order = order;
  }
};

export const orderMove = (
  mover: Entity,
  target: Entity | Point,
  queue = false,
): boolean => {
  updatePathing(mover, 1);

  if (!mover.movementSpeed || !mover.radius) return false;

  const targetPos = "x" in target ? target : target.position;
  if (!targetPos) return false;

  if (queue) {
    mover.queue = [
      ...mover.queue ?? [],
      {
        type: "walk",
        ...("x" in target ? { target } : { targetId: target.id }),
      },
    ];
    return true;
  }

  const path = calcPath(mover, "x" in target ? target : target.id, {
    distanceFromTarget: "x" in target ? undefined : FOLLOW_DISTANCE,
  });
  if (!path.length && "x" in target) return false;

  delete mover.queue;
  mover.order = {
    type: "walk",
    ...("x" in target ? { target } : { targetId: target.id }),
    path,
  };

  return true;
};

const isReachableTarget = (attacker: Entity, target: Entity) => {
  if (!attacker.position) return false;

  // If within attack range...
  if (canSwing(attacker, target, true)) return true;

  // Cannot walk
  if (!attacker.movementSpeed) return false;

  const path = calcPath(attacker, "id" in target ? target.id : target, {
    mode: "attack",
  });

  return path.length > 0 &&
    (path.at(-1)?.x !== attacker.position.x ||
      path.at(-1)?.y !== attacker.position.y);
};

export const acquireTarget = (e: Entity) => {
  const pos = e.position;
  if (!pos) return;

  return getEntitiesInRange(pos.x, pos.y, e.sightRadius ?? 5)
    .filter((e2) =>
      e2.position &&
      isEnemy(e, e2) &&
      testClassification(e, e2, e.attack?.targetsAllowed)
    )
    .map((e2) => [e2, distanceBetweenPoints(pos, e2.position!)] as const)
    .sort((a, b) => {
      if (a[0].prefab === "sheep") {
        if (b[0].prefab !== "sheep") return -1;
      } else if (b[0].prefab === "sheep") return 1;
      return a[1] - b[1];
    }).find(([e2]) => isReachableTarget(e, e2))?.[0];
};

export const orderAttack = (
  attacker: Entity,
  target: Entity | Point,
  queue = false,
  isGroundAttack = false,
): boolean => {
  updatePathing(attacker, 1);
  if (!attacker.attack || !attacker.position) return false;

  if ("id" in target) {
    if (
      !target.position ||
      !testClassification(attacker, target, attacker.attack.targetsAllowed)
    ) return false;

    // If within attack range..
    if (canSwing(attacker, target)) {
      processOrder(attacker, { type: "attack", targetId: target.id }, queue);
      return true;
    }

    // If not in range and no movement, play error sound and abort
    if (!attacker.movementSpeed) {
      if (attacker.position) {
        playSoundAt(attacker.position, "error1");
      }
      return false;
    }

    processOrder(attacker, { type: "attack", targetId: target.id }, queue);
    return true;
  }

  // Ground attack or point target
  if (!attacker.movementSpeed) {
    // For stationary units with ground target
    if (
      distanceBetweenPoints(attacker.position, target) > attacker.attack.range
    ) {
      // Out of range - do nothing
      return false;
    }

    // If this is a ground attack command, attack the ground
    if (isGroundAttack) {
      processOrder(attacker, { type: "attack", target }, queue);
      return true;
    }

    // For regular attack command, find a targetable unit in range of the attacker
    const entitiesInRange = getEntitiesInRange(
      attacker.position.x,
      attacker.position.y,
      attacker.attack.range,
    );

    // Find closest valid target
    const attackData = attacker.attack;
    const validTarget = entitiesInRange
      .filter((e) =>
        e.position &&
        isEnemy(attacker, e) &&
        testClassification(attacker, e, attackData.targetsAllowed) &&
        canSwing(attacker, e)
      )
      .sort((a, b) =>
        distanceBetweenPoints(attacker.position!, a.position!) -
        distanceBetweenPoints(attacker.position!, b.position!)
      )[0];

    if (validTarget) {
      processOrder(
        attacker,
        { type: "attack", targetId: validTarget.id },
        queue,
      );
      return true;
    }

    // No valid target found, do nothing
    return false;
  }

  processOrder(attacker, { type: "attackMove", target }, queue);
  return true;
};

// Minimized relative and maximized absolute such that diagonal tinies cannot
// be built but semi-diagonal stacks can be:
// ..FF
// ..FF
// .oSS
// FFFF
// FF
// The target distance for semi-diagonal stacks is √10/4, while for diagonal
// tinies it is √½
// We can compute a minimum RELATIVE from √½-0.25x = √10/4-0.5x
//                                               x = √10-2√2
// We can then compute ABSOLUTE from √½-0.25*RELATIVE
const RELATIVE = 0.3340;
const ABSOLUTE = 0.6236;
export const computeBuildDistance = (prefab: string) =>
  ABSOLUTE + ((prefabs[prefab].radius ?? 0) * RELATIVE);

export const orderBuild = (
  builder: Entity,
  type: string,
  x: number,
  y: number,
  queue = false,
): boolean => {
  updatePathing(builder, 1);

  // Invalid build order
  if (
    !builder.owner ||
    !builder.position || !builder.radius ||
    !builder.actions?.some((a) => a.type === "build" && a.unitType === type)
  ) return false;

  // Validate pathable
  const temp = tempUnit(builder.owner, type, x, y);
  if (
    !withPathingMap((pm) =>
      pm.withoutEntity(
        builder as SystemEntity<"position" | "radius">,
        () => pathable(temp),
      )
    )
  ) return false;

  processOrder(builder, { type: "build", x, y, unitType: type }, queue);
  return true;
};

export const orderUpgrade = (
  unit: Entity,
  prefabId: string,
  queue = false,
): boolean => {
  if (!unit.owner || !unit.position) return false;

  const action = findAction(
    unit,
    (a) => a.type === "upgrade" && a.prefab === prefabId,
  );
  if (!action) return false;

  processOrder(unit, { type: "upgrade", prefab: prefabId }, queue);
  return true;
};

export const isAlive = (unit: Entity) => {
  if (!appContext.current.entities.has(unit)) return false;
  return typeof unit.health !== "number" || unit.health > 0;
};

export const addItem = (unit: Entity, itemId: string): boolean => {
  const item = items[itemId];
  if (!item) {
    console.warn(`Attempted to add unknown item '${itemId}'`);
    return false;
  }

  if (!unit.inventory) unit.inventory = [];

  // Check if item already exists and has charges
  const existingItem = unit.inventory.find((i) => i.id === itemId);
  if (existingItem && item.charges) {
    // If item has charges and already exists, increase charges
    unit.inventory = unit.inventory.map((i) =>
      i.id === itemId
        ? { ...i, charges: (i.charges || 0) + (item.charges || 1) }
        : i
    );
  } else {
    // Add new item to inventory
    unit.inventory = [...unit.inventory, item];
  }

  return true;
};

export const consumeItem = (unit: Entity, item: Item): boolean => {
  if (!item.charges) return false;
  let found = false;
  unit.inventory = unit.inventory?.map((i) => {
    if (i === item) {
      found = true;
      return { ...i, charges: (i.charges || 1) - 1 };
    }
    return i;
  }).filter((i) => i.charges === undefined || i.charges > 0) || [];
  return found;
};

const getBuildGoldCost = (builder: Entity, type: string) => {
  const buildAction = findAction(
    builder,
    (a) => a.type === "build" && a.unitType === type,
  );
  return (buildAction?.type === "build" ? buildAction.goldCost : undefined) ??
    0;
};

const deductBuildGold = (builder: Entity, type: string) => {
  if (!builder.owner) return;

  deductPlayerGold(builder.owner, getBuildGoldCost(builder, type));
};

/**
 * Computes the total damage a unit can deal, including base damage plus bonuses from items and buffs
 */
export const computeUnitDamage = (unit: Entity): number => {
  if (!unit.attack) return 0;

  let totalDamage = unit.attack.damage;

  // Apply multipliers first, then add bonuses from buffs (including item buffs)
  for (const buff of iterateBuffs(unit)) {
    if (buff.damageMultiplier) {
      totalDamage *= buff.damageMultiplier;
    }
  }

  for (const buff of iterateBuffs(unit)) {
    if (buff.damageBonus) {
      totalDamage += buff.damageBonus;
    }
  }

  return totalDamage;
};

/**
 * Computes the effective attack speed multiplier for a unit, including bonuses from items and buffs
 */
export const computeUnitAttackSpeed = (unit: Entity): number => {
  let speedMultiplier = 1.0;

  // Apply attack speed bonuses from buffs (including item buffs)
  for (const buff of iterateBuffs(unit)) {
    if (buff.attackSpeedMultiplier) {
      speedMultiplier *= buff.attackSpeedMultiplier;
    }
  }

  return speedMultiplier;
};

/**
 * Applies damage mitigation and amplification modifiers
 */
const applyDamageModifiers = (
  damage: number,
  attacker: Entity,
  target: Entity,
): number => {
  let finalDamage = damage *
    (typeof target.progress === "number" ? 2 : 1) *
    (attacker.isMirror ? target.tilemap ? 0.24 : 0.001 : 1);

  // Apply damage mitigation from buffs (including item buffs)
  for (const buff of iterateBuffs(target)) {
    if (buff.damageMitigation) finalDamage *= 1 - buff.damageMitigation;
  }

  return finalDamage;
};

/**
 * Applies buffs from source entities to a target and consumes buffs marked as consumeOnAttack
 * @param sources Entities whose buffs should be checked (e.g., attacker, projectile)
 * @param target Entity that should receive imparted buffs
 */
export const applyAndConsumeBuffs = (
  sources: ReadonlyArray<Entity>,
  target: Entity,
): void => {
  for (const source of sources) {
    // Apply splash damage from buffs (including item buffs)
    for (const buff of iterateBuffs(source)) {
      if (
        buff.splashDamage && buff.splashRadius && buff.splashTargets &&
        target.position
      ) {
        const nearbyEntities = getEntitiesInRange(
          target.position.x,
          target.position.y,
          buff.splashRadius,
        );

        for (const splashTarget of nearbyEntities) {
          if (!testClassification(source, splashTarget, buff.splashTargets)) {
            continue;
          }

          if (splashTarget.health) {
            damageEntity(source, splashTarget, buff.splashDamage, false);
          }
        }
      }
    }

    // Apply buffs to target (from all buffs including item buffs)
    for (const buff of iterateBuffs(source)) {
      if (buff.impartedBuffOnAttack) {
        const buffToApply = buffs[buff.impartedBuffOnAttack];

        // Check if target has immunity to this buff
        const hasImmunity = (target.buffs ?? []).some((targetBuff) =>
          targetBuff.preventsBuffs?.includes(buff.impartedBuffOnAttack!)
        );

        if (!hasImmunity) {
          target.buffs = [
            ...(target.buffs ?? []),
            buffToApply,
          ];
        }
      }
    }

    // Consume buffs from source (direct buffs only)
    if (source.buffs) {
      const updatedBuffs = source.buffs.filter((buff) => !buff.consumeOnAttack);
      if (updatedBuffs.length !== source.buffs.length) {
        source.buffs = updatedBuffs.length ? updatedBuffs : null;
      }
    }

    // Consume buffs from inventory items
    if (source.inventory) {
      let inventoryChanged = false;
      const updatedInventory = source.inventory.map((item) => {
        if (!item.buffs) return item;

        const updatedItemBuffs = item.buffs.filter((buff) =>
          !buff.consumeOnAttack
        );
        if (updatedItemBuffs.length !== item.buffs.length) {
          inventoryChanged = true;
          return updatedItemBuffs.length > 0
            ? { ...item, buffs: updatedItemBuffs }
            : item; // Keep item even if no buffs remain
        }
        return item;
      });

      if (inventoryChanged) {
        source.inventory = updatedInventory;
      }
    }
  }
};

/**
 * Damages one entity from another, handling mitigation and amplification
 * @param attacker The entity dealing damage
 * @param target The entity receiving damage
 * @param amount Optional damage amount. If not specified, uses computeUnitDamage
 * @param pure If true, applies mitigation/amplification. If false, deals pure damage
 */
export const damageEntity = (
  attacker: Entity,
  target: Entity,
  amount?: number,
  pure: boolean = typeof amount === "number",
): void => {
  if (!target.health) return;

  const baseDamage = amount !== undefined
    ? amount
    : computeUnitDamage(attacker);
  const finalDamage = pure
    ? baseDamage
    : applyDamageModifiers(baseDamage, attacker, target);

  target.lastAttacker = attacker.id;
  target.health = Math.max(0, target.health - finalDamage);

  // Consume buffs that are marked as consumeOnAttack
  if (attacker.buffs) {
    attacker.buffs = attacker.buffs.filter((buff) => !buff.consumeOnAttack);
  }
};

export const changePrefab = (
  e: Entity,
  prefabId: string,
  { health = "proportional" }: { health?: "proportional" | "retain" } = {},
) => {
  const hpPercentage = e.maxHealth && e.health ? e.health / e.maxHealth : 1;

  const prev = mergeEntityWithPrefab({ id: e.id, prefab: e.prefab });

  // Pass handicap from owner's player entity to mergeEntityWithPrefab
  const ownerEntity = e.owner ? getPlayer(e.owner) : undefined;
  const next = mergeEntityWithPrefab({
    id: e.id,
    prefab: prefabId,
    handicap: ownerEntity?.handicap,
  });

  if (health === "proportional") {
    if (next.maxHealth) next.health = next.maxHealth * hpPercentage;
  } else if (health === "retain") next.health = prev.health;

  for (const key in prev) if (!(key in next)) delete e[key as keyof Entity];

  Object.assign(e, next);
};

/**
 * Refunds gold for entities that are being destroyed while upgrading or under construction
 * @param entity The entity being destroyed
 * @returns true if a refund was granted
 */
export const refundEntity = (entity: Entity): boolean => {
  if (!entity.owner) return false;

  // Check if entity is upgrading and has a cancel-upgrade action
  if (entity.progress) {
    const cancelUpgradeAction = findAction(
      entity,
      (a) => a.type === "auto" && a.order === "cancel-upgrade",
    );

    if (cancelUpgradeAction) {
      // Refund the cancel-upgrade cost (negative refund = deduction)
      if (cancelUpgradeAction.goldCost) {
        deductPlayerGold(entity.owner, cancelUpgradeAction.goldCost);
        return true;
      }
    } else if (entity.gold) {
      // Refund construction cost if entity is under construction
      grantPlayerGold(entity.owner, entity.gold);
      return true;
    }
  }

  return false;
};
