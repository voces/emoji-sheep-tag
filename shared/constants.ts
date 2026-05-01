export const DEFAULT_FACING = Math.PI;

/** Game tick rate in seconds (50ms per tick) */
export const TICK_RATE = 0.05;

/** ±60° */
export const MAX_ATTACK_ANGLE = Math.PI / 3;

export const MIRROR_SEPARATION = 1.25;

export const FOLLOW_DISTANCE = 0.25;

export const PATHING_WALK_IGNORE_DISTANCE = 2;

export const PATHING_WALK_ANGLE_DIFFERENCE = Math.PI * 2 / 3;

export const SHOP_INTERACTION_RANGE = 2;

export const UPGRADE_REFUND_RATE = 0.85;

export const BUILD_REFUND_RATE = 0.8;

export const DEFAULT_VIP_HANDICAP = 0.8;

/** Gold awarded to the wolf who landed the killing blow on a sheep. */
export const SURVIVAL_KILLER_BOUNTY = 40;
/** Gold awarded to non-killing wolves on the same team. */
export const SURVIVAL_ASSIST_BOUNTY = 15;
/** Bulldog rounds are short and run on smaller economies; bounty is 1/5 of survival. */
export const BULLDOG_KILLER_BOUNTY = 8;
export const BULLDOG_ASSIST_BOUNTY = 3;

export const PATHING_NONE = 0;
export const PATHING_WALKABLE = 1;
export const PATHING_BUILDABLE = 2;
export const PATHING_BLIGHT = 4;
// export const PATHING_UNUSED = 8;
export const PATHING_RESERVED = 16; // pathing is required for collision; this layer should only be used for this
export const PATHING_SOLID = 32; // used for "ghost" entities like the dodge illusion; very similar to buildable

/** Number of water-level steps per cliff level. Stored values divided by this yield cliff-unit heights. */
export const WATER_LEVEL_SCALE = 16;
/** Depth (in cliff units) at which water becomes unwalkable. */
export const WATER_DEEP_DEPTH = 0.75;
