/**
 * Sprites are drawn upright under a top-down camera, so a sprite further south
 * should cover one further north. Each instance carries a sort key in its
 * matrix's z translation: a small value that grows toward the south. The
 * vertex shader removes that z from the geometry and turns it into a depth
 * offset instead, so the depth test orders sprites across all meshes without
 * moving them.
 */

/** Largest z translation used to carry a sort key. Small enough to leave culling and picking alone. */
export const SORT_Z_MAX = 0.1;
/**
 * The band of world y the sort spreads across the depth range. Wider than any
 * map so nothing clamps, but no wider: every world unit it covers is depth
 * resolution that a model's parts have to share. Sprites outside it still draw,
 * they just stop sorting against each other.
 */
const SORT_MIN_Y = -64;
const SORT_SPAN = 1024;

/**
 * How far apart in normalized depth the southernmost and northernmost sprites
 * are. Sprites sit on the z = 0 plane, whose depth is at least 0.8 at the
 * closest zoom, so this keeps every sprite inside the view volume.
 */
const SPRITE_DEPTH_RANGE = 1.5;

/** Normalized depth per world unit of sorting distance. */
export const SORT_DEPTH_PER_UNIT = SPRITE_DEPTH_RANGE / SORT_SPAN;

/**
 * A model's parts are coplanar, so each is nudged toward the camera by its
 * paint order to keep them stacked. That nudge reads as a small southward
 * shift, so a unit's later parts can surface through something it stands level
 * with; this is how wide that band is, in world units. Narrow enough that a
 * unit has to be within a centimetre of level for any of it to show.
 */
const PART_BAND_UNITS = 0.0068;
export const PART_BAND_DEPTH = PART_BAND_UNITS * SORT_DEPTH_PER_UNIT;

/**
 * Smallest depth gap to leave between consecutive parts. A 24-bit depth buffer
 * resolves about 1.2e-7, so this is roughly four steps of it — below that,
 * parts of one model start fighting each other, which looks far worse than the
 * banding it buys. Models with enough parts to hit this floor get a wider band
 * instead.
 */
const PART_MIN_DEPTH_STEP = 5e-7;

/** Render order bands: sorted sprites, then see-through sprites, then overlays. */
export const TRANSLUCENT_RENDER_ORDER = 3000;
export const OVERLAY_RENDER_ORDER = 6000;

/** The instance z that carries the sort key for a sprite whose drawing starts at `baseY`. */
export const sortZ = (baseY: number) =>
  (1 - Math.min(Math.max((baseY - SORT_MIN_Y) / SORT_SPAN, 0), 1)) *
  SORT_Z_MAX;

export type SpriteSort = {
  /** Local y where the drawing starts, before instance scaling. */
  baseY: number;
  /** How far south of its base the sprite sorts, so it can cover things standing in it. */
  bias: number;
};

/**
 * The z translation for an instance at (`x`, `y`): its sort key when the mesh
 * is sorted, otherwise the given `z`. Hidden instances stay at infinity.
 */
export const instanceZ = (
  sort: SpriteSort | undefined,
  x: number,
  y: number,
  scaleY: number,
  z: number,
) => {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return Infinity;
  if (!sort) return Number.isFinite(z) ? z : 0;
  return sortZ(y + sort.baseY * scaleY - sort.bias);
};

/**
 * GLSL for things drawn outside the sprite meshes that should sort with them.
 * `spriteDepthAt` gives the window depth of something rooted at `baseY` on the
 * sprite plane, whose own window depth is `planeDepth`.
 */
export const SPRITE_DEPTH_GLSL = `
  float spriteDepthAt(float planeDepth, float baseY) {
    float south = 1.0 - clamp(
      (baseY - ${SORT_MIN_Y.toFixed(1)}) / ${SORT_SPAN.toFixed(1)},
      0.0,
      1.0
    );
    return planeDepth - ${(SPRITE_DEPTH_RANGE / 2).toFixed(2)} * south;
  }
`;

/** GLSL replacing `#include <project_vertex>` for sorted sprites. */
export const SORTED_PROJECT_VERTEX = `
  vec4 mvPosition = vec4( transformed, 1.0 );
  float spriteSortZ = 0.0;
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
    spriteSortZ = instanceMatrix[3][2];
    mvPosition.z -= spriteSortZ;
  #endif
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;
  gl_Position.z -= ${SPRITE_DEPTH_RANGE.toFixed(1)} *
    clamp(spriteSortZ / ${SORT_Z_MAX.toFixed(1)}, 0.0, 1.0) * gl_Position.w;
`;

/**
 * GLSL nudging each part of a model toward the camera by its paint order, so
 * the parts stack in the order they were drawn. Expects `partID` and
 * `uPartCount` in scope, and to run after `gl_Position` is set.
 */
export const PART_DEPTH_GLSL = `
  gl_Position.z -= partID * max(
    ${PART_MIN_DEPTH_STEP.toExponential(6)},
    ${PART_BAND_DEPTH.toExponential(6)} / max(uPartCount - 1.0, 1.0)
  ) * gl_Position.w;
`;

/** How a mesh is drawn. */
export type SpritePass = "opaque" | "translucent" | "overlay";

export const SPRITE_PASS_DEFINES: Record<SpritePass, number> = {
  opaque: 0,
  translucent: 1,
  overlay: 2,
};

/**
 * GLSL run after `finalOpacity` is known: the opaque pass keeps only fully
 * opaque fragments (and writes depth), the translucent pass keeps the rest.
 */
export const SPRITE_PASS_DISCARD = `
  #if SPRITE_PASS == 0
    if (finalOpacity < 0.999) discard;
  #elif SPRITE_PASS == 1
    if (finalOpacity >= 0.999 || finalOpacity < 0.001) discard;
  #endif
`;

export const spriteMaterialOptions = (pass: SpritePass) => ({
  depthTest: pass !== "overlay",
  depthWrite: pass === "opaque",
});
