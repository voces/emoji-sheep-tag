export const DEFAULT_FACING = 0;

/** Game tick rate in seconds (50ms per tick) */
export const TICK_RATE = 0.05;

/** ±60° */
export const MAX_ATTACK_ANGLE = Math.PI / 3;

export const MIRROR_SEPARATION = 1.25;

export const FOLLOW_DISTANCE = 0.25;

export const PATHING_WALK_IGNORE_DISTANCE = 2;

export const PATHING_WALK_ANGLE_DIFFERENCE = Math.PI / 2;

export const SHOP_INTERACTION_RANGE = 2;

export const UPGRADE_REFUND_RATE = 0.85;

export const BUILD_REFUND_RATE = 0.8;

export const PATHING_NONE = 0;
export const PATHING_WALKABLE = 1;
export const PATHING_BUILDABLE = 2;
export const PATHING_BLIGHT = 4;
export const PATHING_SPIRIT = 8;
export const PATHING_RESERVED = 16; // pathing is required for collision; this layer should only be used for this
export const PATHING_SOLID = 32;
