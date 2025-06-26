import { Classification } from "./data.ts";
import { Point } from "./pathing/math.ts";
import { Footprint, Pathing } from "./pathing/types.ts";

export type WalkAction = {
  readonly type: "walk";
  readonly target: string | { x: number; y: number };
  readonly path: { x: number; y: number }[];
  readonly distanceFromTarget?: number;
  /**
   * If `target` is a string, will stop walking once in range. If `target` is
   * a position, will attack nearby enemies.
   */
  readonly attacking?: boolean;
};

type Action = Readonly<
  WalkAction | {
    readonly type: "build";
    readonly unitType: string;
    readonly x: number;
    readonly y: number;
  } | {
    readonly type: "attack";
    readonly target: string;
  } | {
    readonly type: "hold";
  } | {
    readonly type: "cast";
    readonly remaining: number;
    readonly info: {
      readonly type: "mirrorImage";
      readonly positions: ReadonlyArray<Point>;
    };
  }
>;

export type UnitDataActionTarget = {
  readonly name: string;
  readonly type: "target";
  readonly order: string;
  /** By default, actions can target everything */
  readonly targeting?: Classification[];
  /** `aoe` of `0` allows targeting the ground */
  readonly aoe?: number;
  readonly binding?: string[];
  readonly smart?: { [key in Classification | "ground"]?: number };
};

export type UnitDataAction = {
  readonly name: string;
  readonly type: "build";
  readonly unitType: string;
  readonly binding?: string[];
} | {
  readonly name: string;
  readonly type: "auto";
  readonly order: string;
  readonly binding?: string[];
} | UnitDataActionTarget;

export type Entity = {
  id: string;
  name?: string;
  unitType?: string;
  owner?: string;

  model?: string;
  modelScale?: number;
  sounds?: {
    death?: string[];
    what?: string[];
  };

  position?: { readonly x: number; readonly y: number };
  facing?: number;

  // Data
  health?: number;
  maxHealth?: number;
  mana?: number;
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

  // Actions
  action?: Action | null;
  queue?: ReadonlyArray<Action> | null;
};
