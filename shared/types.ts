import { SystemEntity as ECSSystemEntity } from "jsr:@verit/ecs";
import { Classification } from "./data.ts";
import { Point } from "./pathing/math.ts";
import { Footprint, Pathing } from "./pathing/types.ts";

export type WalkOrder =
  & {
    readonly type: "walk";
    readonly path?: ReadonlyArray<{ x: number; y: number }>;
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
  } | {
    readonly type: "attack";
    readonly targetId: string;
    readonly path?: ReadonlyArray<{ x: number; y: number }>;
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
  } | {
    readonly type: "attackMove";
    readonly target: Readonly<Point>;
    /** Current acquired target */
    readonly targetId?: string;
    readonly path?: ReadonlyArray<{ x: number; y: number }>;
  }
>;

export type Item = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  readonly gold: number;
  readonly binding: ReadonlyArray<string>;
  readonly damage?: number;
  readonly attackSpeedMultiplier?: number;
  readonly movementSpeedBonus?: number;
  readonly charges?: number;
  readonly actions?: ReadonlyArray<UnitDataAction>;
};

export type Buff = {
  readonly remainingDuration: number;
  readonly attackSpeedMultiplier?: number;
  readonly movementSpeedBonus?: number;
  readonly movementSpeedMultiplier?: number;
  readonly expiration?: string;
  readonly progressEasing?: {
    readonly type: "ease-in" | "ease-out" | "ease-in-out";
    readonly duration: number;
  };
};

type IconEffect = "mirror";

export type UnitDataActionTarget = {
  readonly name: string;
  readonly type: "target";
  readonly order: string;
  readonly description?: string;
  readonly icon?: string;
  readonly iconEffect?: IconEffect;
  /** By default, actions can target everything */
  readonly targeting?: ReadonlyArray<Classification>;
  /** `aoe` of `0` allows targeting the ground */
  readonly aoe?: number;
  readonly binding?: ReadonlyArray<string>;
  readonly smart?: { [key in Classification | "ground"]?: number };
  readonly manaCost?: number;
  readonly castDuration?: number;
  readonly range?: number;
  readonly damage?: number;
};

export type UnitDataAction = {
  readonly name: string;
  readonly type: "build";
  readonly unitType: string;
  readonly description?: string;
  readonly icon?: string;
  readonly binding?: ReadonlyArray<string>;
  readonly manaCost?: number;
  readonly goldCost?: number;
  readonly castDuration?: number;
} | {
  readonly name: string;
  readonly type: "auto";
  readonly order: string;
  readonly description?: string;
  readonly icon?: string;
  readonly iconEffect?: IconEffect;
  readonly binding?: ReadonlyArray<string>;
  readonly manaCost?: number;
  readonly castDuration?: number;
  readonly buffDuration?: number;
  readonly attackSpeedMultiplier?: number;
  readonly movementSpeedBonus?: number;
  readonly movementSpeedMultiplier?: number;
  readonly soundOnCastStart?: string;
} | {
  readonly name: string;
  readonly type: "purchase";
  readonly itemId: string;
  readonly goldCost: number;
  readonly description?: string;
  readonly icon?: string;
  readonly binding?: ReadonlyArray<string>;
  readonly manaCost?: number;
  readonly castDuration?: number;
} | {
  readonly name: string;
  readonly type: "menu";
  readonly icon?: string;
  readonly actions: ReadonlyArray<UnitDataAction>;
  readonly description?: string;
  readonly binding?: ReadonlyArray<string>;
} | UnitDataActionTarget;

export type Entity = {
  id: string;
  name?: string;
  prefab?: string;
  owner?: string;

  model?: string;
  modelScale?: number;
  alpha?: number;
  icon?: string;
  iconEffect?: IconEffect;
  sounds?: {
    ackAttack?: ReadonlyArray<string>;
    birth?: ReadonlyArray<string>;
    death?: ReadonlyArray<string>;
    what?: ReadonlyArray<string>;
  };

  position?: { readonly x: number; readonly y: number };
  facing?: number;

  // Data
  health?: number;
  maxHealth?: number;
  healthRegen?: number;
  mana?: number;
  maxMana?: number;
  manaRegen?: number;

  // Player data
  isPlayer?: boolean;
  team?: "sheep" | "wolf";
  gold?: number;

  movementSpeed?: number;
  /** Radians per second */
  turnSpeed?: number;
  actions?: ReadonlyArray<UnitDataAction>;
  completionTime?: number;
  progress?: number | null;
  /** A doodad cannot be clicked */
  isDoodad?: boolean | null;

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
  };
  swing?: {
    readonly remaining: number;
    readonly source: { readonly x: number; readonly y: number };
    readonly target: { readonly x: number; readonly y: number };
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
   * 8 spirit (non-0 required for distanceBetweenEntities)
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

  // Orders
  order?: Order | null;
  queue?: ReadonlyArray<Order> | null;
};

export type SystemEntity<K extends keyof Entity> = ECSSystemEntity<Entity, K>;

export const nonNull = <T>(v: T): v is NonNullable<T> => !!v;
