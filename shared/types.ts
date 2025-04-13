import { Footprint, Pathing } from "./pathing/types.ts";

type Action = Readonly<
  {
    readonly type: "walk";
    readonly target: string | { x: number; y: number };
    readonly path: { x: number; y: number }[];
    readonly distanceFromTarget?: number;
    /**
     * If `target` is a string, will stop walking once in range. If `target` is
     * a position, will attack nearby enemies.
     */
    readonly attacking?: boolean;
  } | {
    readonly type: "build";
    readonly unitType: string;
    readonly x: number;
    readonly y: number;
  } | {
    readonly type: "attack";
    readonly target: string;
  } | {
    readonly type: "hold";
  }
>;

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
};

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
  /** A doodad cannot be clicked */
  isDoodad?: boolean | null;

  // Attacking
  swing?: {
    readonly time: number;
    readonly source: { readonly x: number; readonly y: number };
    readonly target: { readonly x: number; readonly y: number };
  } | null;
  lastAttack?: number;

  // Tags
  isMoving?: boolean | null;
  isAttacking?: boolean | null;
  isIdle?: boolean | null;

  // Pathing
  radius?: number;
  pathing?: Pathing;
  /** Override `pathing` for require checks. */
  requiresPathing?: Pathing;
  /** Override `pathing` when blocking tiles. */
  blocksPathing?: Pathing;
  tilemap?: Footprint;

  // Actions
  action?: Action | null;
  queue?: ReadonlyArray<Action> | null;
};
