import { Footprint, Pathing } from "./pathing/types.ts";

type Action = Readonly<
  {
    type: "walk";
    target: string | { x: number; y: number };
    path: { x: number; y: number }[];
    distanceFromTarget?: number;
  } | {
    type: "build";
    unitType: string;
    x: number;
    y: number;
  } | {
    type: "attack";
    target: string | { x: number; y: number };
  } | {
    type: "swing";
    target: string;
    start: number;
  }
>;

export type Entity = {
  id: string;
  unitType?: string;
  owner?: string;
  mana?: number;
  position?: { readonly x: number; readonly y: number };
  movementSpeed?: number;

  // Data
  builds?: string[];
  attack?: {
    damage: number;
    range: number;
    /** How far a unit may move between the start of an attack and the damage point */
    rangeMotionBuffer: number;
    /** Seconds between attacks starting */
    cooldown: number;
    /** Seconds between an attack starting and damage occuring */
    damagePoint: number;
    /** Last time an attack started */
    last?: number;
  };

  // Tags
  isMoving?: boolean | null;
  isPathing?: boolean | null;

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
