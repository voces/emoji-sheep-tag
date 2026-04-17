/**
 * Uniform-side state for the unit-ripple shader. Every material that
 * includes `WATER_SHADER_RIPPLES` points at the objects exported here, so
 * updating the Float32Array / count in place propagates to every shader
 * without per-material bookkeeping.
 *
 * The ECS-facing driver that populates these each frame lives in
 * `client/systems/waterRipples.ts`. Keeping the uniforms in `graphics/`
 * avoids a circular import between graphics/three.ts and the system.
 */

import { WATER_RIPPLE_MAX } from "./waterShader.ts";

export const waterRippleData = new Float32Array(WATER_RIPPLE_MAX * 4);

export const waterRippleUniforms = {
  waterRippleCount: { value: 0 },
  waterRipples: { value: waterRippleData },
};
