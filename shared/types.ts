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

type Order = Readonly<
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
    readonly positions?: ReadonlyArray<Point>;
    readonly started?: boolean;
  } | {
    readonly type: "attackMove";
    readonly target: Point;
    /** Current acquired target */
    readonly targetId?: string;
    readonly path?: ReadonlyArray<{ x: number; y: number }>;
  }
>;

export type UnitDataActionTarget = {
  readonly name: string;
  readonly type: "target";
  readonly order: string;
  /** By default, actions can target everything */
  readonly targeting?: ReadonlyArray<Classification>;
  /** `aoe` of `0` allows targeting the ground */
  readonly aoe?: number;
  readonly binding?: ReadonlyArray<string>;
  readonly smart?: { [key in Classification | "ground"]?: number };
  readonly manaCost?: number;
  readonly castDuration?: number;
};

export type Item = {
  readonly id: string;
  readonly name: string;
  readonly icon?: string;
  readonly gold: number;
  readonly binding: ReadonlyArray<string>;
  readonly damage?: number;
  readonly attackSpeedMultiplier?: number;
  readonly charges?: number;
  readonly actions?: ReadonlyArray<UnitDataAction>;
};

export type UnitDataAction = {
  readonly name: string;
  readonly type: "build";
  readonly unitType: string;
  readonly binding?: ReadonlyArray<string>;
  readonly manaCost?: number;
  readonly goldCost?: number;
  readonly castDuration?: number;
} | {
  readonly name: string;
  readonly type: "auto";
  readonly order: string;
  readonly binding?: ReadonlyArray<string>;
  readonly manaCost?: number;
  readonly castDuration?: number;
} | {
  readonly name: string;
  readonly type: "purchase";
  readonly itemId: string;
  readonly binding?: ReadonlyArray<string>;
  readonly goldCost: number;
  readonly manaCost?: number;
  readonly castDuration?: number;
} | {
  readonly name: string;
  readonly type: "menu";
  readonly binding?: ReadonlyArray<string>;
  readonly actions: ReadonlyArray<UnitDataAction>;
} | UnitDataActionTarget;

export type Entity = {
  id: string;
  name?: string;
  prefab?: string;
  owner?: string;

  model?: string;
  modelScale?: number;
  sounds?: {
    death?: ReadonlyArray<string>;
    what?: ReadonlyArray<string>;
  };

  position?: { readonly x: number; readonly y: number };
  facing?: number;

  // Data
  health?: number;
  maxHealth?: number;
  mana?: number;
  maxMana?: number;
  manaRegen?: number;

  // Player data
  isPlayer?: boolean;
  gold?: number;

  movementSpeed?: number;
  /** Radians per second */
  turnSpeed?: number;
  actions?: ReadonlyArray<UnitDataAction>;
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
  completionTime?: number;
  progress?: number | null;
  /** A doodad cannot be clicked */
  isDoodad?: boolean | null;

  // Attacking
  swing?: {
    readonly remaining: number;
    readonly source: { readonly x: number; readonly y: number };
    readonly target: { readonly x: number; readonly y: number };
  } | null;
  attackCooldownRemaining?: number | null;

  isMirror?: boolean;
  mirrors?: ReadonlyArray<string> | null;

  // Pathing
  radius?: number;
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

  // Orders
  order?: Order | null;
  queue?: ReadonlyArray<Order> | null;
};

export type SystemEntity<K extends keyof Entity> = ECSSystemEntity<Entity, K>;

export const nonNull = <T>(v: T): v is NonNullable<T> => !!v;
