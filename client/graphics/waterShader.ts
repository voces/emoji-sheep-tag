/**
 * Shared GLSL fragments for water rendering. Used by Terrain2D and by the
 * entity materials that tint submerged sprite portions, so water colors and
 * surface motion stay consistent between the terrain and the things standing
 * in it. Treat each export as a drop-in GLSL snippet: declarations go in the
 * vertex/fragment header, and the helper functions can be called from main().
 */

export const WATER_SHADER_CONSTANTS = /* glsl */ `
  const vec3 WATER_SHALLOW = vec3(0.34, 0.52, 0.66);
  const vec3 WATER_DEEP = vec3(0.06, 0.10, 0.16);
  const vec3 WATER_FOAM = vec3(1.0);
  const vec3 WATER_CAUSTICS = vec3(0.85, 0.92, 0.95);
`;

export const WATER_SHADER_NOISE = /* glsl */ `
  float waterHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float waterNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(waterHash(i), waterHash(i + vec2(1.0, 0.0)), f.x),
      mix(waterHash(i + vec2(0.0, 1.0)), waterHash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
`;

/**
 * Small surface oscillation in cliff-height units. Phase depends on world
 * position so nearby points ripple in sync. Peak-to-peak ~0.13 cliff units,
 * dominated by a 4s period; a second phase-shifted ripple prevents the
 * surface from looking like rigid parallel stripes.
 */
export const WATER_SHADER_MOTION = /* glsl */ `
  // Primary wave phase, in radians. Exposed separately so consumers that
  // need the raw phase (e.g. wet-sand decay timing) stay in sync with the
  // actual wave crest positions inside waterWaveOffset.
  float waterWavePhase(vec2 worldXY, float t) {
    const float PI2 = 6.2831853;
    return t * (PI2 / 4.0) + worldXY.x * 0.6 + worldXY.y * 0.4;
  }

  float waterWaveOffset(vec2 worldXY, float t) {
    const float PI2 = 6.2831853;
    float wavePhase = waterWavePhase(worldXY, t);
    float wave2Phase = t * (PI2 / 5.3) - worldXY.x * 0.55 + worldXY.y * 0.85;
    return sin(wavePhase) * 0.04 + sin(wave2Phase) * 0.025;
  }

  float waterTideOffset(float t) {
    const float PI2 = 6.2831853;
    return sin(t * (PI2 / 97.5)) * 0.125;
  }
`;

/**
 * Maximum number of simultaneous unit-ripple sources passed to the water
 * shader. Keep in sync with the `WATER_RIPPLE_MAX` define in
 * `WATER_SHADER_RIPPLES` and the Float32Array length in the CPU system.
 *
 * Each active ring is one source. Units in water emit a fresh ring every
 * `RIPPLE_EMIT_PERIOD` seconds, each lives `RIPPLE_LIFETIME` seconds.
 * With ~2 active rings per wet entity, this caps comfortable wet-entity
 * count at ~32.
 */
export const WATER_RIPPLE_MAX = 64;

/**
 * Unit-emitted ripple signal. Each entry is a ring anchored at the world
 * position where it was emitted (it does NOT follow the entity afterward),
 * with an age that drives outward expansion and fade. A walking unit
 * emits a fresh ring every couple seconds, leaving a trail of expanding
 * rings behind it — that trail is the wake; for stationary units, the
 * same mechanism just produces a periodic ripple at the unit's spot.
 *
 * Uniforms (declared by this snippet):
 *   uniform int  waterRippleCount;
 *   uniform vec4 waterRipples[WATER_RIPPLE_MAX]; // (x, y, age, radius)
 *
 *   `age`    seconds since emission
 *   `radius` entity radius at emission time (rings scale with unit size)
 *
 * Callers should ADD the return value to `causticsN` before computing
 * the disturbance / caustic-band / foam pipeline. Routing it through the
 * same caustic processing as the natural noise field means rings get
 * the same flat-shaded color bands and foam highlights as the rest of
 * the water — they read as "extra caustic energy" the surface is
 * carrying, not as a separate stamped overlay.
 */
export const WATER_SHADER_RIPPLES = /* glsl */ `
  #define WATER_RIPPLE_MAX ${WATER_RIPPLE_MAX}
  /** Disk expansion speed in world units per second. Constant across all
   * entity sizes — big units just get longer lifetimes so their disks
   * travel further. */
  #define WATER_RIPPLE_SPEED 0.45
  /** Lifetime grows with entity radius so a big unit's disk travels
   * further and lingers longer. Total = BASE + PER_RADIUS*r. */
  #define WATER_RIPPLE_LIFETIME_BASE 1.2
  #define WATER_RIPPLE_LIFETIME_PER_RADIUS 2.4
  uniform int waterRippleCount;
  uniform vec4 waterRipples[WATER_RIPPLE_MAX];

  float waterRippleSignal(vec2 worldXY) {
    float total = 0.0;
    for (int i = 0; i < WATER_RIPPLE_MAX; i++) {
      if (i >= waterRippleCount) break;
      vec4 r = waterRipples[i];
      vec2 center = r.xy;
      float age = r.z;
      float radius = r.w;

      float lifetime =
        WATER_RIPPLE_LIFETIME_BASE + radius * WATER_RIPPLE_LIFETIME_PER_RADIUS;
      float lifeT = clamp(age / lifetime, 0.0, 1.0);

      // Crest-shaped gradient: smoothly ramps up from zero at the center
      // to a peak at the leading edge (crest), then falls off sharply
      // beyond. Real ripples behave this way — a wave crest travels
      // outward with a soft tail trailing behind. Adding this to the
      // caustic noise field below lets the existing band thresholds
      // (0.60/0.78/0.92) and foam threshold (1.05) naturally carve
      // concentric flat-shaded rings out of the gradient — the visible
      // ring shapes come from the same banding as the rest of the
      // water, without needing an explicit ring/wobble model.
      //
      // Crest starts partway into the entity's silhouette and expands
      // outward. Starting at the full radius looked oversized; starting
      // at zero looked too small. Half-radius is the sweet spot — the
      // ripple emerges from within the entity's footprint.
      float crest = radius * 0.5 + age * WATER_RIPPLE_SPEED;
      float leadingWidth = max(0.12, crest * 0.18);
      float distC = length(worldXY - center);
      float inner = smoothstep(0.0, crest, distC);
      float outer = 1.0 - smoothstep(crest, crest + leadingWidth, distC);
      float shape = inner * outer;

      // Fade in gently so the crest eases into view rather than popping,
      // then quadratically fade out so it doesn't linger at low
      // intensity. The 20% fade-in window (of the per-ring lifetime)
      // makes stationary pulses feel less aggressive since idle units
      // get long lifetimes.
      float fadeIn = smoothstep(0.0, 0.20, lifeT);
      float lifeRem = 1.0 - lifeT;
      float fade = fadeIn * lifeRem * lifeRem;

      total = max(total, shape * fade);
    }
    return total;
  }

  // Soft-blend: caustic * 0.75 is the damping factor. Higher = more
  // suppression in bright areas (lower peak), lower = more linear
  // (brighter peak). 0.75 splits the difference between the full
  // screen-blend (1.0, too weak overall) and the half-damped (0.5,
  // too spiky at peaks).
  //
  //   caustic=0.2 → 85% of ripple lands  (strong in calm water)
  //   caustic=0.5 → 63% lands            (visible mid-range)
  //   caustic=0.8 → 40% lands            (suppressed near peaks)
  float blendRipple(float caustic, float ripple) {
    return caustic + ripple * (1.0 - caustic * 0.9);
  }
`;

/**
 * Caustic shimmer: a warped noise field that ripples with the wave phase.
 * Returns a value in [0, 1] with peaks clustered around 0.6–1.0. Callers
 * should feather the output (e.g. with smoothstep) to extract bright rings
 * rather than applying it directly.
 */
export const WATER_SHADER_CAUSTICS = /* glsl */ `
  float waterCaustics(vec2 worldXY, float t) {
    const float PI2 = 6.2831853;
    float wavePhase = t * (PI2 / 4.0) + worldXY.x * 0.6 + worldXY.y * 0.4;
    float wave2Phase = t * (PI2 / 5.3) - worldXY.x * 0.55 + worldXY.y * 0.85;
    vec2 rippleWarp = vec2(sin(wavePhase), sin(wave2Phase)) * 0.04;
    vec2 causticsBase =
      worldXY * vec2(0.55, 1.1)
      + vec2(t * 0.012, -t * 0.008)
      + rippleWarp;
    vec2 warpPos = worldXY * 2.2 + vec2(t * 0.05, t * 0.04);
    vec2 warpOffset = vec2(
      waterNoise(warpPos) - 0.5,
      waterNoise(warpPos + vec2(4.7, 2.1)) - 0.5
    ) * 0.25;
    return waterNoise(causticsBase + warpOffset);
  }
`;

/**
 * Varyings declared by the entity vertex/fragment snippets below. Include in
 * both shader stages.
 */
export const WATER_SHADER_ENTITY_VARYINGS = /* glsl */ `
  varying float vWaterline;
  varying float vWaterDepthT;
  varying vec2 vWaterWorldXY;
  flat varying float vSubmergence;
`;

/**
 * Vertex-stage helper for entity materials. Call from `main()` after decoding
 * a `float submergence` in [0, 1]. Reads three.js built-ins (`position`,
 * `modelMatrix`, `instanceMatrix`) and the `uTime` uniform; writes the
 * `vWaterWorldXY` varying and a local `waterWaveOffset_` that the caller adds
 * to the sprite-Y waterline:
 *   ${WATER_SHADER_ENTITY_VERTEX}
 *   vWaterline = <spriteY attr> - submergence - waterWaveOffset_;
 * The motion is gated by `submergence > 0.0` so dry entities aren't dragged
 * under by a phantom waterline when the tide swings.
 */
export const WATER_SHADER_ENTITY_VERTEX = /* glsl */ `
  vWaterWorldXY = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xy;
  vec2 waterInstanceWorldXY =
    (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xy;
  float waterWaveOffset_ = submergence > 0.0
    ? waterWaveOffset(waterInstanceWorldXY, uTime) + waterTideOffset(uTime)
    : 0.0;
  // Depth factor drives the shallow→deep color mix in the fragment tint.
  // submergence is depth/(2*radius); scaling by 0.75 makes sub=1.33 (e.g. a
  // small entity in ~0.67 worth of water) read as "fully deep", roughly
  // matching the terrain's bodyDepth/0.75 depthT.
  vWaterDepthT = clamp(submergence * 0.75, 0.0, 1.0);
  vSubmergence = submergence;
`;

/**
 * Fragment-stage tint block for entity materials. Apply after the normal
 * vColor/diffuseColor path so the water surface layers on top of the base
 * sprite color. Requires `WATER_SHADER_CONSTANTS`, `WATER_SHADER_NOISE`,
 * `WATER_SHADER_CAUSTICS`, and `WATER_SHADER_RIPPLES` to be declared
 * above, plus the `vWaterline`, `vWaterWorldXY`, `vInstanceMinimapMask`
 * varyings and `uTime` uniform. Uses the same disturbance/foam model as
 * Terrain2D so entity shorelines read as part of the same water surface.
 */
export const WATER_SHADER_ENTITY_TINT = /* glsl */ `
  if (vInstanceMinimapMask < 0.5 && vSubmergence > 0.0 && vWaterline < 0.0) {
    vec3 waterCol_ = mix(WATER_SHALLOW, WATER_DEEP, vWaterDepthT);
    diffuseColor.rgb = mix(diffuseColor.rgb, waterCol_, 0.6);
    float waterDepth_ = -vWaterline;
    float waterShoreProx_ = 1.0 - smoothstep(0.0, 0.15, waterDepth_);
    // Ripple signal is screen-blended with the caustic noise rather
    // than linearly added, so it can't spike past 1.0 into the foam
    // threshold — visible in calm water, gently saturating in bright
    // spots rather than producing harsh white flares.
    float waterCausticsN_ = blendRipple(
      waterCaustics(vWaterWorldXY, uTime),
      waterRippleSignal(vWaterWorldXY));
    float waterDisturbance_ = waterCausticsN_ + waterShoreProx_ * 0.65;
    float waterNoiseFoam_ = smoothstep(0.95, 1.15, waterDisturbance_);
    float waterMinFoam_ = 1.0 - smoothstep(0.015, 0.025, waterDepth_);
    float waterFoamBand_ = max(waterMinFoam_, waterNoiseFoam_);
    diffuseColor.rgb =
      mix(diffuseColor.rgb, WATER_FOAM, waterFoamBand_ * 0.75);
    float waterShimmer_ = smoothstep(0.72, 0.95, waterCausticsN_);
    diffuseColor.rgb = mix(
      diffuseColor.rgb, WATER_CAUSTICS,
      waterShimmer_ * 0.35 * (1.0 - waterFoamBand_));
  }
`;
