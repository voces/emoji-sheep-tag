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

  // Tags
  moving?: boolean | null;

  // Pathing
  radius?: number;
  pathing?: Pathing;
  /** Override `pathing` for require checks. */
  requiresPathing?: Pathing;
  /** Override `pathing` when blocking tiles. */
  blocksPathing?: Pathing;
  tilemap?: Footprint;
  structure?: boolean;

  // Actions
  action?: Action | null;
  queue?: ReadonlyArray<Action> | null;
};
