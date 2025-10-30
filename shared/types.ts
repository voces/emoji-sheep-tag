import { SystemEntity as ECSSystemEntity } from "@verit/ecs";
import { Classification } from "./data.ts";
import { Point } from "./pathing/math.ts";
import { Footprint, Pathing } from "./pathing/types.ts";

export type WalkOrder =
  & {
    readonly type: "walk";
    readonly path?: ReadonlyArray<{ x: number; y: number }>;
    readonly lastRepath?: number;
  }
  & (
    | { readonly targetId: string }
    | { readonly target: { x: number; y: number } }
  );

export type Order = Readonly<
  WalkOrder | {
    readonly type: "build";
    readonly unitType: string;
    readonly x: number;
    readonly y: number;
    readonly path?: ReadonlyArray<{ x: number; y: number }>;
    readonly lastRepath?: number;
  } | {
    readonly type: "upgrade";
    readonly prefab: string;
  } | {
    readonly type: "attack";
    readonly targetId: string;
    readonly path?: ReadonlyArray<{ x: number; y: number }>;
    readonly lastRepath?: number;
  } | {
    readonly type: "attack";
    readonly target: Readonly<Point>;
  } | {
    readonly type: "hold";
  } | {
    readonly type: "cast";
    readonly orderId: string;
    readonly remaining: number;
    readonly target?: Readonly<Point>;
    readonly targetId?: string;
    readonly path?: ReadonlyArray<{ x: number; y: number }>;
    readonly started?: boolean;
    readonly lastRepath?: number;
  } | {
    readonly type: "attackMove";
    readonly target: Readonly<Point>;
    /** Current acquired target */
    readonly targetId?: string;
    readonly path?: ReadonlyArray<{ x: number; y: number }>;
    readonly lastRepath?: number;
  }
>;

export type Item = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  readonly gold: number;
  readonly binding: ReadonlyArray<string>;
  readonly charges?: number;
  readonly actions?: ReadonlyArray<UnitDataAction>;
  readonly buffs?: ReadonlyArray<Buff>;
};

export type Buff = {
  readonly remainingDuration?: number;
  readonly attackSpeedMultiplier?: number;
  readonly movementSpeedBonus?: number;
  readonly movementSpeedMultiplier?: number;
  readonly damageBonus?: number;
  readonly damageMultiplier?: number;
  readonly healthRegen?: number;
  readonly damageMitigation?: number;
  readonly bountyMultiplier?: number;
  readonly bountyBonus?: number;
  readonly consumeOnAttack?: boolean;
  readonly impartedBuffOnAttack?: string;
  readonly splashDamage?: number;
  readonly splashRadius?: number;
  readonly splashTargets?: ReadonlyArray<ReadonlyArray<Classification>>;
  readonly expiration?: string;
  readonly totalDuration?: number;
  readonly progressEasing?: {
    readonly type: "ease-in" | "ease-out" | "ease-in-out";
    readonly duration: number;
  };
  readonly radius?: number;
  readonly auraBuff?: string;
  readonly targetsAllowed?: ReadonlyArray<ReadonlyArray<Classification>>;
  readonly tickDamage?: number;
  readonly tickInterval?: number;
  readonly icon?: string;
  readonly model?: string;
  readonly modelOffset?: { readonly x?: number; readonly y?: number };
  readonly modelScale?: number;
  readonly particleRate?: number;
  readonly particleOffsetRange?: number;
  readonly particleMinOffsetRange?: number;
  readonly particleScaleRange?: number;
  readonly particleLifetime?: number;
};

type IconEffect = "mirror";

export type UnitDataActionTarget = {
  readonly name: string;
  readonly type: "target";
  readonly order: string;
  readonly description?: string;
  readonly icon?: string;
  readonly iconEffect?: IconEffect;
  /** By default, actions can target everything. Outer array is OR, inner array is AND */
  readonly targeting?: ReadonlyArray<ReadonlyArray<Classification>>;
  /** `aoe` of `0` allows targeting the ground */
  readonly aoe?: number;
  readonly binding?: ReadonlyArray<string>;
  readonly smart?: { [key in Classification | "ground"]?: number };
  readonly manaCost?: number;
  readonly goldCost?: number;
  readonly castDuration?: number;
  readonly range?: number;
  readonly damage?: number;
  readonly allowAllies?: boolean;
};

export type UnitDataActionUpgrade = {
  readonly name: string;
  readonly type: "upgrade";
  readonly prefab: string;
  readonly description?: string;
  readonly icon?: string;
  readonly binding?: ReadonlyArray<string>;
  readonly goldCost?: number;
  readonly castDuration?: number;
  readonly allowAllies?: boolean;
};

export type UnitDataAction =
  | {
    readonly name: string;
    readonly type: "build";
    readonly unitType: string;
    readonly description?: string;
    readonly icon?: string;
    readonly binding?: ReadonlyArray<string>;
    readonly manaCost?: number;
    readonly goldCost?: number;
    readonly castDuration?: number;
    readonly allowAllies?: boolean;
  }
  | UnitDataActionUpgrade
  | {
    readonly name: string;
    readonly type: "auto";
    readonly order: string;
    readonly description?: string;
    readonly icon?: string;
    readonly iconEffect?: IconEffect;
    readonly binding?: ReadonlyArray<string>;
    readonly manaCost?: number;
    readonly goldCost?: number;
    readonly castDuration?: number;
    readonly buffDuration?: number;
    readonly attackSpeedMultiplier?: number;
    readonly movementSpeedBonus?: number;
    readonly movementSpeedMultiplier?: number;
    readonly damageMultiplier?: number;
    readonly manaRestore?: number;
    readonly soundOnCastStart?: string;
    readonly allowAllies?: boolean;
    readonly prefab?: string;
    readonly canExecuteWhileConstructing?: boolean;
  }
  | {
    readonly name: string;
    readonly type: "purchase";
    readonly itemId: string;
    readonly goldCost: number;
    readonly description?: string;
    readonly icon?: string;
    readonly binding?: ReadonlyArray<string>;
    readonly manaCost?: number;
    readonly castDuration?: number;
    readonly allowAllies?: boolean;
  }
  | {
    readonly name: string;
    readonly type: "menu";
    readonly icon?: string;
    readonly actions: ReadonlyArray<UnitDataAction>;
    readonly description?: string;
    readonly binding?: ReadonlyArray<string>;
    readonly allowAllies?: boolean;
    readonly goldCost?: number;
  }
  | UnitDataActionTarget;

export type Entity = {
  id: string;
  name?: string;
  prefab?: string;
  owner?: string;
  /**
   * Spawn mode for entities defined in map files:
   *
   * - "cosmetic": client-only. Spawned in the client ECS; the server does not create or track it.
   *   Purely visual; never replicated.
   *
   * - "static": local on both sides. Spawned independently in client and server ECS.
   *   Not replicated; IDs may differ; no network traffic involves these entities.
   *
   * - "dynamic" (default): server-authoritative. Spawned on the server and replicated/synced to clients.
   */
  type?: "cosmetic" | "static" | "dynamic";

  model?: string | null;
  modelScale?: number | null;
  vertexColor?: number | null;
  playerColor?: string | null;
  alpha?: number;
  icon?: string;
  iconEffect?: IconEffect;
  sounds?: {
    ackAttack?: ReadonlyArray<string>;
    birth?: ReadonlyArray<string>;
    death?: ReadonlyArray<string>;
    what?: ReadonlyArray<string>;
    projectileHit?: ReadonlyArray<string>;
  };

  position?: { readonly x: number; readonly y: number };
  facing?: number | null;

  // Data
  health?: number | null;
  maxHealth?: number;
  healthRegen?: number;
  mana?: number;
  maxMana?: number;
  manaRegen?: number;

  // Player data
  isPlayer?: boolean;
  team?: "sheep" | "wolf";
  gold?: number;
  handicap?: number;
  sheepTime?: number;

  movementSpeed?: number;
  /** Radians per second */
  turnSpeed?: number;
  sightRadius?: number;
  actions?: ReadonlyArray<UnitDataAction>;
  completionTime?: number;
  progress?: number | null;
  // Maybe replace with selectable?
  /** A doodad cannot be clicked */
  isDoodad?: boolean | null;
  isTimer?: boolean;
  isFloatingText?: boolean;
  /** Only visible to the owner's team */
  teamScoped?: boolean;

  // Attacking
  attack?: {
    readonly damage: number;
    readonly range: number;
    /** How far a unit may move between the start of an attack and the damage point */
    readonly rangeMotionBuffer: number;
    /** Seconds between attacks starting */
    readonly cooldown: number;
    /** Seconds between an attack starting and an attack being committed (can miss) */
    readonly backswing: number;
    /** Seconds between an attack starting and damage occurring */
    readonly damagePoint: number;
    readonly projectileSpeed?: number;
    readonly model?: string;
    readonly targetsAllowed?: ReadonlyArray<ReadonlyArray<Classification>>;
  } | null;
  swing?: {
    readonly remaining: number;
    readonly source: { readonly x: number; readonly y: number };
    readonly target: { readonly x: number; readonly y: number };
  } | null;
  projectile?: {
    readonly attackerId: string;
    readonly target: { readonly x: number; readonly y: number };
    readonly speed: number;
    readonly splashRadius: number;
  } | null;
  attackCooldownRemaining?: number | null;
  lastAttacker?: string | null;
  /** By default, can be targeted by anything */
  targetedAs?: ReadonlyArray<Classification>;

  isMirror?: boolean;
  mirrors?: ReadonlyArray<string> | null;

  // Pathing
  radius?: number;
  /**
   * 1 walkable
   * 2 buildable
   * 4 blight
   * 8 spirit
   * 16 reserved
   */
  pathing?: Pathing;
  /** Override `pathing` for require checks. */
  requiresPathing?: Pathing;
  /** Override `pathing` when blocking tiles. */
  blocksPathing?: Pathing;
  tilemap?: Footprint;
  /** Override `tilemap` for require checks. */
  requiresTilemap?: Footprint;

  // Items
  inventory?: ReadonlyArray<Item>;

  // Buffs
  buffs?: ReadonlyArray<Buff> | null;

  // Bounty
  bounty?: number;

  // Fog of war
  blocksLineOfSight?: number; // Number of height levels this blocks vision

  // Grouping
  unique?: boolean;

  // Orders
  order?: Order | null;
  queue?: ReadonlyArray<Order> | null;
};

export type SystemEntity<K extends keyof Entity> = ECSSystemEntity<Entity, K>;

export const nonNull = <T>(v: T): v is NonNullable<T> => !!v;
