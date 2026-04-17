/**
 * Drives the `waterRippleUniforms` each frame. We track which entities
 * are standing in water (via a `position` add/change callback that
 * re-checks `getWaterDepthAtWorld`); each wet entity periodically emits a
 * ring at its current position. The ring is anchored where it was emitted
 * — it does NOT follow the entity afterward — so a moving unit leaves a
 * trail of expanding rings behind it (= wake), and a stationary unit
 * just gets a periodic ripple at its spot.
 *
 * Rings live a fixed lifetime, then drop out. Each frame we age every
 * active ring, prune dead ones, then pack the youngest up to
 * WATER_RIPPLE_MAX into the shared uniform. Per-source data is
 * (centerX, centerY, age, radius) — the shader expands and fades from age
 * and scales width from radius.
 */

import { Entity } from "@/shared/types.ts";
import { addSystem } from "@/shared/context.ts";
import { getMap } from "@/shared/map.ts";
import { getWaterDepthAtWorld } from "@/shared/pathing/terrainHelpers.ts";
import { ParticleEmitter, svgToTexture } from "../graphics/ParticleEmitter.ts";
import { onRender } from "../graphics/three.ts";
import waterDropSvg from "../assets/waterDrop.svg" with { type: "text" };
import { WATER_RIPPLE_MAX } from "../graphics/waterShader.ts";
import {
  waterRippleData,
  waterRippleUniforms,
} from "../graphics/waterRipples.ts";

/** Must match the lifetime formula in `WATER_SHADER_RIPPLES`. Bigger
 * units get longer-lived rings so their ripples travel further and
 * linger. */
const RIPPLE_LIFETIME_BASE = 1.2;
const RIPPLE_LIFETIME_PER_RADIUS = 2.4;
const rippleLifetime = (radius: number) =>
  RIPPLE_LIFETIME_BASE + radius * RIPPLE_LIFETIME_PER_RADIUS;
// Emission rate (rings/sec) scales with speed:
//   stationary  → IDLE_RATE       (1 ring per ~5s — lazy ambient pulse)
//   moving fast → IDLE_RATE + SPEED_RATE_PER_UNIT * speed, capped at MAX_RATE
const IDLE_RATE = 1 / 5.0;
const SPEED_RATE_PER_UNIT = 3.0;
const MAX_RATE = 6.0;
const DEFAULT_RADIUS = 0.25;

type WetState = {
  progress: number;
  splashProgress: number;
  lastX: number;
  lastY: number;
  /** Water depth at the entity's foot, in world units. Refreshed on every
   * position change so the ring emission height tracks local depth. */
  depth: number;
  /** Set on the first frame the entity is in water — triggers an entry
   * splash and is cleared immediately after. */
  justEntered?: boolean;
};
const wet = new Map<Entity, WetState>();

const updateWetness = (e: Entity) => {
  if (!e.position || e.isEffect || e.isDoodad) {
    wet.delete(e);
    return;
  }
  // Only entities that can move emit ripples. Structures, resources, and
  // other stationary things shouldn't disturb the water just by existing.
  if (!e.movementSpeed) {
    wet.delete(e);
    return;
  }
  let map;
  try {
    map = getMap();
  } catch {
    return;
  }
  const depth = getWaterDepthAtWorld(
    e.position.x,
    e.position.y,
    map.cliffs,
    map.water,
  );
  const rad = e.radius ?? DEFAULT_RADIUS;
  // `2 * radius` is the entity's full vertical extent (the same basis the
  // shader's submergence uses). Once water is that deep, the entity is
  // fully submerged and shouldn't ripple the surface at all.
  const fullySubmerged = depth >= 2 * rad;
  if (depth > 0 && !fullySubmerged) {
    const existing = wet.get(e);
    if (existing) {
      existing.depth = depth;
    } else {
      // Start partway into the cycle (per-entity offset via id hash) so
      // newly-wet units don't all emit in lockstep.
      const offset = Math.abs(hashString(e.id)) % 1000 / 1000;
      wet.set(e, {
        progress: offset,
        splashProgress: 0,
        lastX: e.position.x,
        lastY: e.position.y,
        depth,
        justEntered: true,
      });
    }
  } else {
    if (wet.has(e) && e.position) {
      // Entity just left water — start lingering for trailing splashes.
      lingering.set(e, {
        remaining: SPLASH_LINGER_DURATION,
        radius: e.radius ?? DEFAULT_RADIUS,
        lastX: e.position.x,
        lastY: e.position.y,
        progress: 0,
      });
    }
    wet.delete(e);
  }
};

const hashString = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h | 0;
};

addSystem<Entity, "position">({
  props: ["position"],
  onAdd: updateWetness,
  onChange: updateWetness,
  onRemove: (e) => wet.delete(e),
});

type Ring = { x: number; y: number; age: number; radius: number };
const rings: Ring[] = [];

const splashEmitter = new ParticleEmitter();
svgToTexture(waterDropSvg).then((tex) => splashEmitter.setTexture(tex));
const SPLASH_SPEED_THRESHOLD = 0.8;
const SPLASH_LINGER_DURATION = 0.4;

type LingerState = {
  remaining: number;
  radius: number;
  lastX: number;
  lastY: number;
  progress: number;
};
const lingering = new Map<Entity, LingerState>();

const emitDroplet = (
  time: number,
  x: number,
  y: number,
  speed: number,
  radius: number,
  moveDx = 0,
  moveDy = 0,
) => {
  const baseScale = radius * 0.25;
  // Spray biased upward (+Y = screen-up) and backward (opposite of
  // movement). A random angle is blended with the backward direction
  // so the spray fans out but trends away from the unit's heading.
  const randomAngle = Math.random() * Math.PI * 2;
  const moveDist = Math.sqrt(moveDx * moveDx + moveDy * moveDy);
  let biasAngle = randomAngle;
  if (moveDist > 0.001) {
    // Backward = opposite of movement direction
    const backAngle = Math.atan2(-moveDy, -moveDx);
    // Upward on screen = +Y = PI/2. Blend between backward and upward.
    const targetAngle = backAngle * 0.35 + Math.PI / 2 * 0.65;
    // Mix random with biased direction (75% bias, 25% random spread)
    biasAngle = targetAngle + (randomAngle - Math.PI) * 0.4;
  }
  const spd = (0.3 + Math.random() * 0.7) *
    Math.min(3.0, Math.max(speed * 0.6, 0.5));
  const offsetDist = Math.random() * radius * 0.4;
  const offsetAngle = Math.random() * Math.PI * 2;
  const scale = baseScale * (0.5 + Math.random() * 1.5);
  const v = 0.9 + Math.random() * 0.1;
  // The shader now computes velocity-aligned rotation dynamically, so
  // the rotation attribute is just the SVG alignment offset. The
  // waterDrop SVG's point faces +Y in UV space, so -PI/2 rotates its
  // natural "up" to align with the velocity angle the shader computes.
  const dropRotation = Math.PI / 2;
  splashEmitter.emit({
    time,
    x: x + Math.cos(offsetAngle) * offsetDist,
    y: y + Math.sin(offsetAngle) * offsetDist,
    vx: Math.cos(biasAngle) * spd,
    vy: Math.sin(biasAngle) * spd,
    startScale: scale,
    endScale: scale * 0.15,
    lifetime: 0.5 + Math.random() * 0.5,
    color: [v, v, v],
    alpha: 0.5 + Math.random() * 0.3,
    gravity: 1.5 + Math.random() * 1.0,
    rotation: dropRotation,
  });
};

onRender((delta, time) => {
  splashEmitter.update(time);

  // Age and prune existing rings. Lifetime varies per ring based on the
  // emitter's radius (see `rippleLifetime`).
  for (let i = rings.length - 1; i >= 0; i--) {
    rings[i].age += delta;
    if (rings[i].age >= rippleLifetime(rings[i].radius)) rings.splice(i, 1);
  }

  // Emit fresh rings from wet entities. Rate scales with measured speed
  // so movers leave a denser trail. We use a `progress` accumulator
  // (advances by delta * rate) rather than a fixed period — that way
  // mid-stride speed changes adjust the cadence smoothly without
  // having to retime an absolute clock.
  const safeDelta = Math.max(delta, 1e-4);
  for (const [e, state] of wet) {
    if (!e.position) continue;
    const dx = e.position.x - state.lastX;
    const dy = e.position.y - state.lastY;
    const speed = Math.sqrt(dx * dx + dy * dy) / safeDelta;
    state.lastX = e.position.x;
    state.lastY = e.position.y;
    const radiusVal = e.radius ?? DEFAULT_RADIUS;

    // Entry splash: first frame in water, kick the splash accumulator
    // forward so droplets start immediately rather than waiting for
    // the first tick.
    if (state.justEntered) {
      state.justEntered = false;
      if (speed > SPLASH_SPEED_THRESHOLD) state.splashProgress = 1;
    }

    // Waterline offset (shared by both ripple rings and splash droplets):
    // sprites are visually upright on screen regardless of facing, so
    // the waterline offset is always along world-Y. The tide oscillation
    // shifts the effective water depth so the emission point tracks the
    // visual waterline from the shader.
    const PI2 = Math.PI * 2;
    const tide = Math.sin(time * (PI2 / 97.5)) * 0.125;
    const effectiveDepth = state.depth + tide;
    const submergenceFraction = Math.min(
      1,
      Math.max(0, effectiveDepth) / (2 * radiusVal),
    );
    const offsetMag = (submergenceFraction - 0.5) * 2 * radiusVal;

    // Continuous splash droplets: single particles at a high rate
    // (proportional to speed) rather than periodic batches, so the
    // spray reads as a steady stream instead of burst-pause-burst.
    // Emitted from the waterline position, biased upward (+Y) and
    // backward (opposite of movement direction).
    if (speed > SPLASH_SPEED_THRESHOLD) {
      const splashRate = Math.min(20, speed * 5);
      state.splashProgress += delta * splashRate;
      const splashX = e.position.x;
      const splashY = e.position.y + offsetMag;
      while (state.splashProgress >= 1) {
        state.splashProgress -= 1;
        emitDroplet(
          time,
          splashX,
          splashY,
          speed,
          radiusVal,
          dx,
          dy,
        );
      }
    }

    const rate = Math.min(IDLE_RATE + speed * SPEED_RATE_PER_UNIT, MAX_RATE);
    state.progress += delta * rate;
    if (state.progress >= 1) {
      state.progress -= 1;

      // Speed-scaled effective radius: a stationary unit emits at its
      // baseline radius; a moving unit emits a bigger ripple (and via
      // the lifetime formula, a longer-lived one too — so wakes from
      // sprinting units read as larger and more energetic than idle
      // ambient ripples).
      const speedBoost = Math.min(1.0, speed * 0.25);
      const effectiveRadius = radiusVal * (1 + speedBoost);

      // Lead the unit: shift the emission point forward along the
      // direction of motion so ripples appear to spawn just in front of
      // a moving unit (like the bow wave on a boat). Lead distance
      // grows with speed and caps so it doesn't run out ahead of the
      // unit at high speeds. Stationary units emit at their position.
      let leadX = 0;
      let leadY = 0;
      if (speed > 0.05) {
        const leadDistance = Math.min(0.15, speed * 0.05);
        const moveDist = speed * safeDelta;
        leadX = (dx / moveDist) * leadDistance;
        leadY = (dy / moveDist) * leadDistance;
      }

      const ringX = e.position.x + leadX;
      const ringY = e.position.y + offsetMag + leadY;

      rings.push({
        x: ringX,
        y: ringY,
        age: 0,
        radius: effectiveRadius,
      });
    }
  }

  // Lingering splash: entities that just left water keep emitting
  // a few trailing droplets for a brief period. Rate decays linearly
  // over the linger window so the splash tapers off naturally.
  for (const [e, ls] of lingering) {
    ls.remaining -= delta;
    if (ls.remaining <= 0 || !e.position) {
      lingering.delete(e);
      continue;
    }
    const ldx = e.position.x - ls.lastX;
    const ldy = e.position.y - ls.lastY;
    const lingerSpeed = Math.sqrt(ldx * ldx + ldy * ldy) / safeDelta;
    ls.lastX = e.position.x;
    ls.lastY = e.position.y;
    if (lingerSpeed > SPLASH_SPEED_THRESHOLD) {
      const decay = ls.remaining / SPLASH_LINGER_DURATION;
      const splashRate = Math.min(20, lingerSpeed * 5) * decay;
      ls.progress += delta * splashRate;
      if (ls.progress >= 1) {
        ls.progress -= 1;
        emitDroplet(
          time,
          e.position.x,
          e.position.y,
          lingerSpeed * decay,
          ls.radius,
        );
      }
    }
  }

  // If we exceed the cap, keep the youngest (most visible) rings.
  if (rings.length > WATER_RIPPLE_MAX) {
    rings.sort((a, b) => a.age - b.age);
    rings.length = WATER_RIPPLE_MAX;
  }

  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    waterRippleData[i * 4 + 0] = r.x;
    waterRippleData[i * 4 + 1] = r.y;
    waterRippleData[i * 4 + 2] = r.age;
    waterRippleData[i * 4 + 3] = r.radius;
  }
  for (let i = rings.length * 4; i < waterRippleData.length; i++) {
    waterRippleData[i] = 0;
  }
  waterRippleUniforms.waterRippleCount.value = rings.length;
});
