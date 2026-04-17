import {
  DataTexture,
  FloatType,
  LinearFilter,
  Mesh,
  PlaneGeometry,
  RedFormat,
  RGBAFormat,
  ShaderMaterial,
  SRGBColorSpace,
  UnsignedByteType,
  Vector2,
} from "three";
import { getCliffHeight } from "@/shared/pathing/terrainHelpers.ts";
import { WATER_LEVEL_SCALE } from "@/shared/constants.ts";
import {
  WATER_SHADER_CAUSTICS,
  WATER_SHADER_CONSTANTS,
  WATER_SHADER_MOTION,
  WATER_SHADER_NOISE,
  WATER_SHADER_RIPPLES,
} from "./waterShader.ts";
import { waterRippleUniforms } from "./waterRipples.ts";

export type Cliff = number | "r";
export type CliffMask = Cliff[][];
export type WaterMask = number[][];

type TerrainMasks = {
  cliff: CliffMask;
  groundTile: number[][];
  cliffTile: number[][];
  water: WaterMask;
};

const buildHeightTexture = (cliffMask: CliffMask): DataTexture => {
  const h = cliffMask.length * 2;
  const w = cliffMask[0].length * 2;
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      data[y * w + x] = getCliffHeight(x, y, cliffMask);
    }
  }
  const tex = new DataTexture(data, w, h, RedFormat, FloatType);
  tex.needsUpdate = true;
  return tex;
};

/**
 * Water texture stores water level in cliff units at 2x cliff mask resolution.
 * 0 = no water. Sampled with linear filtering in the shader for soft shores.
 */
const buildWaterTexture = (waterMask: WaterMask): DataTexture => {
  const h = waterMask.length * 2;
  const w = waterMask[0].length * 2;
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const my = Math.min(Math.floor(y / 2), waterMask.length - 1);
      const row = waterMask[my];
      const mx = Math.min(Math.floor(x / 2), row.length - 1);
      data[y * w + x] = (row[mx] ?? 0) / WATER_LEVEL_SCALE;
    }
  }
  const tex = new DataTexture(data, w, h, RedFormat, FloatType);
  tex.needsUpdate = true;
  return tex;
};

export const buildCliffTexture = (cliffMask: CliffMask): DataTexture => {
  // High-res distance field at 4x cliff mask resolution.
  // Distance measured from nearest different-integer-height cell BOUNDARY.
  // Ramps get maxR (no cliff).
  const scale = 4;
  const h = cliffMask.length * scale;
  const w = cliffMask[0].length * scale;
  const maxR = 12;
  const dist = new Float32Array(w * h);

  // Pre-compute integer heights per cliff mask cell
  const maskH = cliffMask.length;
  const maskW = cliffMask[0].length;
  const intHeight = new Float32Array(maskH * maskW);
  const isRamp = new Uint8Array(maskH * maskW);
  for (let my = 0; my < maskH; my++) {
    for (let mx = 0; mx < maskW; mx++) {
      const v = cliffMask[my][mx];
      if (v === "r") {
        isRamp[my * maskW + mx] = 1;
        intHeight[my * maskW + mx] = -999;
      } else {
        intHeight[my * maskW + mx] = v;
      }
    }
  }

  // Pre-compute per mask cell: list of different-height neighbor offsets, ramp info
  const cellDiffNeighbors: [number, number][][] = new Array(maskH * maskW);
  const rampInfo = new Int8Array(maskH * maskW * 4); // [hDiff, vDiff, topOrLeftRamp, botOrRightRamp]
  for (let my = 0; my < maskH; my++) {
    for (let mx = 0; mx < maskW; mx++) {
      const idx = my * maskW + mx;
      if (isRamp[idx]) {
        const left = mx > 0 && !isRamp[idx - 1] ? intHeight[idx - 1] : -1;
        const right = mx < maskW - 1 && !isRamp[idx + 1]
          ? intHeight[idx + 1]
          : -1;
        const up = my > 0 && !isRamp[idx - maskW] ? intHeight[idx - maskW] : -1;
        const down = my < maskH - 1 && !isRamp[idx + maskW]
          ? intHeight[idx + maskW]
          : -1;
        const hDiff = left >= 0 && right >= 0 && left !== right;
        const vDiff = up >= 0 && down >= 0 && up !== down;
        const ri = idx * 4;
        rampInfo[ri] = hDiff ? 1 : 0;
        rampInfo[ri + 1] = vDiff ? 1 : 0;
        if (hDiff) {
          rampInfo[ri + 2] = my > 0 && isRamp[idx - maskW] ? 1 : 0;
          rampInfo[ri + 3] = my < maskH - 1 && isRamp[idx + maskW] ? 1 : 0;
        } else if (vDiff) {
          rampInfo[ri + 2] = mx > 0 && isRamp[idx - 1] ? 1 : 0;
          rampInfo[ri + 3] = mx < maskW - 1 && isRamp[idx + 1] ? 1 : 0;
        }
        continue;
      }
      const myH = intHeight[idx];
      const neighbors: [number, number][] = [];
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const ny = my + dy, nx = mx + dx;
          if (ny < 0 || ny >= maskH || nx < 0 || nx >= maskW) continue;
          const nIdx = ny * maskW + nx;
          if (isRamp[nIdx] || intHeight[nIdx] === myH) continue;
          neighbors.push([dx, dy]);
        }
      }
      cellDiffNeighbors[idx] = neighbors;
    }
  }

  // Sub-pixel positions (reused for all cells)
  const subPos = new Float32Array(scale);
  for (let i = 0; i < scale; i++) subPos[i] = (i + 0.5) / scale;

  // Fill distance field
  for (let my = 0; my < maskH; my++) {
    for (let mx = 0; mx < maskW; mx++) {
      const idx = my * maskW + mx;
      const baseY = my * scale, baseX = mx * scale;

      if (isRamp[idx]) {
        const ri = idx * 4;
        const hDiff = rampInfo[ri], vDiff = rampInfo[ri + 1];
        const adj1Ramp = rampInfo[ri + 2], adj2Ramp = rampInfo[ri + 3];
        for (let sy = 0; sy < scale; sy++) {
          const svy = subPos[sy];
          for (let sx = 0; sx < scale; sx++) {
            let rampDist = maxR;
            if (hDiff) {
              const dTop = adj1Ramp ? maxR : svy * 0.931;
              const dBot = adj2Ramp ? maxR : (1.0 - svy) * 0.931;
              rampDist = dTop < dBot ? dTop : dBot;
            } else if (vDiff) {
              const svx = subPos[sx];
              const dLeft = adj1Ramp ? maxR : svx * 0.931;
              const dRight = adj2Ramp ? maxR : (1.0 - svx) * 0.931;
              rampDist = dLeft < dRight ? dLeft : dRight;
            }
            dist[(baseY + sy) * w + baseX + sx] = rampDist;
          }
        }
        continue;
      }

      const neighbors = cellDiffNeighbors[idx];
      if (!neighbors || neighbors.length === 0) {
        // No different-height neighbors: all sub-pixels are maxR
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            dist[(baseY + sy) * w + baseX + sx] = maxR;
          }
        }
        continue;
      }

      // Check if any neighbor is adjacent (dist will be < 1 guaranteed)
      let hasClose = false;
      for (let i = 0; i < neighbors.length; i++) {
        const dx = neighbors[i][0], dy = neighbors[i][1];
        if (dx >= -1 && dx <= 1 && dy >= -1 && dy <= 1) {
          hasClose = true;
          break;
        }
      }
      if (!hasClose) {
        // All neighbors are 2+ cells away — dist > 1.0 for all sub-pixels, fill maxR
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            dist[(baseY + sy) * w + baseX + sx] = maxR;
          }
        }
        continue;
      }

      for (let sy = 0; sy < scale; sy++) {
        const svy = subPos[sy];
        for (let sx = 0; sx < scale; sx++) {
          const svx = subPos[sx];
          let minDistSq = maxR * maxR;
          for (let i = 0; i < neighbors.length; i++) {
            const dx = neighbors[i][0], dy = neighbors[i][1];
            const cx = dx > svx ? dx : svx < dx + 1 ? svx : dx + 1;
            const cy = dy > svy ? dy : svy < dy + 1 ? svy : dy + 1;
            const ddx = svx - cx, ddy = svy - cy;
            const dSq = ddx * ddx + ddy * ddy;
            if (dSq < minDistSq) minDistSq = dSq;
          }
          dist[(baseY + sy) * w + baseX + sx] = Math.sqrt(minDistSq);
        }
      }
    }
  }
  // Extend ramp walls along the ramp direction into adjacent integer cells
  for (let my = 0; my < maskH; my++) {
    for (let mx = 0; mx < maskW; mx++) {
      if (!isRamp[my * maskW + mx]) continue;
      const left = mx > 0 && !isRamp[my * maskW + mx - 1]
        ? intHeight[my * maskW + mx - 1]
        : -1;
      const right = mx < maskW - 1 && !isRamp[my * maskW + mx + 1]
        ? intHeight[my * maskW + mx + 1]
        : -1;
      const up = my > 0 && !isRamp[(my - 1) * maskW + mx]
        ? intHeight[(my - 1) * maskW + mx]
        : -1;
      const down = my < maskH - 1 && !isRamp[(my + 1) * maskW + mx]
        ? intHeight[(my + 1) * maskW + mx]
        : -1;
      const hDiff = left >= 0 && right >= 0 && left !== right;
      const vDiff = up >= 0 && down >= 0 && up !== down;
      if (!hDiff && !vDiff) continue;
      // Extend along ramp toward low side (longer walls)
      const dirs: [number, number][] = [];
      if (hDiff) {
        if (left >= 0 && left < right) dirs.push([-1, 0]);
        if (right >= 0 && right < left) dirs.push([1, 0]);
      }
      if (vDiff) {
        if (up >= 0 && up < down) dirs.push([0, -1]);
        if (down >= 0 && down < up) dirs.push([0, 1]);
      }
      for (const [ddx, ddy] of dirs) {
        const nmy = my + ddy, nmx = mx + ddx;
        if (nmy < 0 || nmy >= maskH || nmx < 0 || nmx >= maskW) continue;
        if (isRamp[nmy * maskW + nmx]) continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const intoCell = ddy !== 0
              ? (ddy > 0 ? sy : scale - 1 - sy)
              : (ddx > 0 ? sx : scale - 1 - sx);
            if (intoCell > 1) continue;
            // Source: matching sub-pixel on the ramp's edge facing this neighbor
            const srcSy = ddy > 0 ? scale - 1 : ddy < 0 ? 0 : sy;
            const srcSx = ddx > 0 ? scale - 1 : ddx < 0 ? 0 : sx;
            const rampD = dist[(my * scale + srcSy) * w + mx * scale + srcSx];
            if (rampD >= maxR) continue;
            const tgtY = nmy * scale + sy;
            const tgtX = nmx * scale + sx;
            const extended = rampD + 0.04 * (intoCell + 1);
            if (extended < dist[tgtY * w + tgtX]) {
              dist[tgtY * w + tgtX] = extended;
            }
          }
        }
      }
    }
  }

  // Extend ramp walls 1 sub-pixel outward (perpendicular, into ground)
  const distCopy = new Float32Array(dist);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = distCopy[y * w + x];
      if (d >= 0.35 || d <= 0) continue; // not a wall pixel
      const my = Math.floor(y / scale);
      const mx = Math.floor(x / scale);
      // Extend from any wall pixel that's in or adjacent to a ramp cell
      const isNearRamp = isRamp[my * maskW + mx] ||
        (my > 0 && isRamp[(my - 1) * maskW + mx]) ||
        (my < maskH - 1 && isRamp[(my + 1) * maskW + mx]) ||
        (mx > 0 && isRamp[my * maskW + mx - 1]) ||
        (mx < maskW - 1 && isRamp[my * maskW + mx + 1]);
      if (!isNearRamp) continue;
      // Try extending into each cardinal neighbor sub-pixel
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const nmy = Math.floor(ny / scale);
        const nmx = Math.floor(nx / scale);
        // Only extend into non-ramp cells (ground)
        if (nmy === my && nmx === mx) continue; // same cell
        if (isRamp[nmy * maskW + nmx]) continue;
        const extended = d + 0.05;
        if (extended < dist[ny * w + nx]) dist[ny * w + nx] = extended;
      }
    }
  }

  const data = new Uint8Array(w * h);
  for (let i = 0; i < dist.length; i++) {
    data[i] = Math.min(255, Math.round(dist[i] / 2.0 * 255));
  }
  const tex = new DataTexture(data, w, h, RedFormat, UnsignedByteType);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
};

const parseHexColor = (hex: string): [number, number, number] => {
  const v = parseInt(hex.replace("#", ""), 16);
  return [(v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF];
};

const buildTileColorTexture = (
  groundTile: number[][],
  tiles: { color: string }[],
): DataTexture => {
  const h = groundTile.length * 2;
  const w = groundTile[0].length * 2;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tileIndex = groundTile[Math.floor(y / 2)]?.[Math.floor(x / 2)] ?? 0;
      const [r, g, b] = parseHexColor(tiles[tileIndex]?.color ?? "#ff0000");
      const idx = (y * w + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  const tex = new DataTexture(data, w, h, RGBAFormat, UnsignedByteType);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};

const vertexShader = `
  varying vec2 vUv;
  varying vec2 vWorldPos;
  void main() {
    vUv = uv;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D heightMap;
  uniform sampler2D cliffMap;
  uniform sampler2D tileColorMap;
  uniform sampler2D waterMap;
  uniform vec2 texelSize;
  /** 0 = hide water, 1 = normal, 2 = show water mask as indicator over dry cells */
  uniform int waterViewMode;
  uniform float time;

  varying vec2 vUv;
  varying vec2 vWorldPos;

  ${WATER_SHADER_CONSTANTS}
  ${WATER_SHADER_NOISE}
  ${WATER_SHADER_MOTION}
  ${WATER_SHADER_CAUSTICS}
  ${WATER_SHADER_RIPPLES}

  // Aliases so the existing non-water uses of the noise field below still
  // read naturally. Both refer to the shared waterHash/waterNoise impl.
  float hash(vec2 p) { return waterHash(p); }
  float vnoise(vec2 p) { return waterNoise(p); }

  // Bilinear-interpolated height (smooth across texel boundaries)
  float heightSmooth(vec2 uv) {
    vec2 tc = uv / texelSize - 0.5;
    vec2 tf = floor(tc);
    vec2 fr = tc - tf;
    vec2 base = (tf + 0.5) * texelSize;
    return mix(
      mix(texture2D(heightMap, base).r,
          texture2D(heightMap, base + vec2(texelSize.x, 0.0)).r, fr.x),
      mix(texture2D(heightMap, base + vec2(0.0, texelSize.y)).r,
          texture2D(heightMap, base + texelSize).r, fr.x),
      fr.y
    );
  }

  // Bilinear-interpolated water level (0 = no water)
  float waterSmooth(vec2 uv) {
    vec2 tc = uv / texelSize - 0.5;
    vec2 tf = floor(tc);
    vec2 fr = tc - tf;
    vec2 base = (tf + 0.5) * texelSize;
    return mix(
      mix(texture2D(waterMap, base).r,
          texture2D(waterMap, base + vec2(texelSize.x, 0.0)).r, fr.x),
      mix(texture2D(waterMap, base + vec2(0.0, texelSize.y)).r,
          texture2D(waterMap, base + texelSize).r, fr.x),
      fr.y
    );
  }

  void main() {
    vec2 wp = vWorldPos;
    vec3 tileColor = texture2D(tileColorMap, vUv).rgb;

    float smoothH = heightSmooth(vUv);

    // Cliff: distance from nearest different-height cell boundary (0=at boundary, 1=1 cell in)
    float cliffDist = texture2D(cliffMap, vUv).r * 2.0;
    // Ring: cliff texture from edge to 75% into cell, flat top beyond
    float cliffAmount = (1.0 - step(0.35, cliffDist)) * step(0.001, cliffDist);

    // Cliff coloring: stepped color bands following smooth height contours
    // 2 bands per height level, naturally more bands for bigger cliffs
    float steps = 2.0;
    float band = floor(smoothH * steps) / steps;
    float bandT = band / 6.0;
    vec3 rockLight = vec3(0.90, 0.78, 0.58);
    vec3 rockDark = vec3(0.68, 0.50, 0.30);
    vec3 rockColor = mix(rockDark, rockLight, clamp(bandT, 0.0, 1.0));
    // Directional shading: darken north and east facing cliff faces
    float shL = heightSmooth(vUv - vec2(texelSize.x, 0.0));
    float shR = heightSmooth(vUv + vec2(texelSize.x, 0.0));
    float shD = heightSmooth(vUv - vec2(0.0, texelSize.y));
    float shU = heightSmooth(vUv + vec2(0.0, texelSize.y));
    vec2 grad = vec2(shR - shL, shU - shD);
    // Light from south-west: north/east facing = away from light = darker
    float shade = dot(normalize(grad + 0.001), vec2(-0.7, -0.7));
    rockColor *= 1.0 - clamp(shade, 0.0, 1.0) * 0.25;

    // Ground
    float n = vnoise(wp * 1.2);
    vec3 groundColor = tileColor * (0.97 + n * 0.06);

    // Apply height brightness to ground
    groundColor *= 0.26 + smoothH * 0.37;
    rockColor *= 0.70 + smoothH * 0.12;
    vec3 color = mix(groundColor, rockColor, cliffAmount);

    // Water overlay: anywhere smoothWater > waterGroundH, tint toward deep water.
    if (waterViewMode != 0) {
      // In cliff zones the bilinear smoothH gives a gentle ramp that lets
      // water creep halfway up the cliff face. Warp the decimal portion of
      // the height with a pow(d, 1/1.5) curve so the effective ground rises
      // quickly toward the next integer step — water at 1.25 on a 1→2 cliff
      // terminates near 12.5% up the wall instead of 25%. Blended in with
      // cliffDist so the transition at the ring edge is smooth.
      float integerH = floor(smoothH);
      float decimalH = smoothH - integerH;
      float steepenedH = integerH + pow(decimalH, 1.0 / 2.0);
      float cliffWeight = 1.0 - smoothstep(0.30, 0.40, cliffDist);
      float waterGroundH = mix(smoothH, steepenedH, cliffWeight);
      float rawWater = waterSmooth(vUv);

      // Compute ripple once here and reuse for both the height wash and
      // the caustic blend below — avoids looping the ring array twice.
      float ripple = waterRippleSignal(vWorldPos);

      // Tide (long-period) and wave (short-period ripples) come from the
      // shared water-motion module, so the terrain and any entities standing
      // in the water oscillate in lockstep.
      float tide = waterTideOffset(time);
      float waveSum = waterWaveOffset(vWorldPos, time);
      float waterPresence = smoothstep(0.001, 0.05, rawWater);
      // Body depth uses tide only — it drives color and alpha, so waves
      // shouldn't cause visible bands sweeping across the water surface.
      // Shore depth includes the waves so the shoreline still laps.
      float bodyWater = rawWater + tide * waterPresence;
      float smoothWater = bodyWater + waveSum * waterPresence;
      float depth = smoothWater - waterGroundH;

      // Ripple shore wash: the crest pushes the waterline onto the
      // beach, but ONLY in the narrow band around the existing shore.
      // Gated so it can't create phantom water on dry ramps/cliffs
      // (the old rawWater approach did that). Fades to zero both far
      // onto dry land (can't reach) and in deep water (not needed).
      float washGate =
        smoothstep(-0.2, 0.0, depth) * (1.0 - smoothstep(0.0, 0.1, depth));
      depth += ripple * 0.24 * washGate;

      float bodyDepth = bodyWater - waterGroundH;

      // Smooth shore: fade water alpha across a screen-space-sized band
      // around depth=0. Using fwidth makes the fade exactly as wide as
      // one pixel's worth of depth variation, so the waterline is
      // anti-aliased both spatially (no jaggies) and temporally (no
      // flicker as waves oscillate the shore across pixels).
      float edgeWidth = max(fwidth(depth), 0.002);
      float waterEdge = smoothstep(0.0, edgeWidth, depth);
      float depthT = clamp(bodyDepth / 0.75, 0.0, 1.0);
      vec3 waterCol = mix(WATER_SHALLOW, WATER_DEEP, depthT);
      // Shore line starts visible (~0.35) and approaches opaque in deep water.
      float waterAlpha = clamp(0.35 + depthT * 0.55, 0.0, 0.92) * waterEdge;
      color = mix(color, waterCol, waterAlpha);

      // Unified surface disturbance: one noise field models both open
      // water "caustics" and the shoreline "foam" as different levels
      // of surface agitation. Open water has only the baseline noise;
      // near the shore we add a big boost so the noise signal pushes
      // past a high "heavy disturbance" threshold, which renders as
      // white foam. Wave crests hitting the shore push the signal
      // even higher, temporarily widening/thickening the foam.
      // crestFactor is normalized against the peak amplitude of the
      // shared waterWaveOffset (0.04 + 0.025 = 0.065).
      // Unit-emitted ripple signal is screen-blended with the caustic
      // noise — visible in calm water, saturating gently in bright
      // spots rather than linearly spiking past the foam threshold.
      float crestFactor = max(waveSum / 0.065, 0.0);
      float causticsN = blendRipple(
        waterCaustics(vWorldPos, time),
        ripple);

      // Shoreline boost: depth range is scaled by local cliff
      // steepness so 2+ level cliffs keep a visible foam band despite
      // their fast-rising depth. We use the true 2D gradient
      // magnitude (length of dFdx/dFdy in world units) rather than
      // fwidth, because fwidth is L1 (|ddx|+|ddy|) which doubles at
      // cliff corners and jumps discontinuously at texel boundaries —
      // that's what makes the foam abruptly thicker around corners.
      // The L2 length gives a continuous gradient magnitude that
      // grows only ~1.4x at corners, and we cap the scale so corners
      // don't blow up the band.
      float gradX = dFdx(smoothH) / max(abs(dFdx(vWorldPos.x)), 0.0001);
      float gradY = dFdy(smoothH) / max(abs(dFdy(vWorldPos.y)), 0.0001);
      float heightPerWorld = length(vec2(gradX, gradY));
      float gradScale = clamp(heightPerWorld, 1.0, 2.2);
      float shoreRange = (0.05 + 0.04 * crestFactor) * gradScale;
      float shoreProx = 1.0 - smoothstep(0.0, shoreRange, depth);

      // Disturbance = noise + shore boost + crest-at-shore boost. In
      // open water it equals causticsN (0..1 range); at the shoreline
      // it can reach ~1.85, pushing past the foam threshold.
      float disturbance =
        causticsN + shoreProx * 0.65 + crestFactor * shoreProx * 0.2;
      float distFw = max(fwidth(disturbance), 0.005);

      // Four concentric thresholds. Outer + inner + peak fire on
      // raw noise peaks (causticsN, unaffected by the shore boost),
      // so the caustic rings stay localized to actual blob peaks and
      // don't turn into cliff-shaped bands where shoreProx is high.
      // The foam threshold fires on the boosted disturbance signal —
      // it only triggers near the shore where the boost pushes past
      // the max noise value.
      float causticsFw = max(fwidth(causticsN), 0.005);
      float outerBand =
        smoothstep(0.60 - causticsFw, 0.60 + causticsFw, causticsN);
      float innerBand =
        smoothstep(0.78 - causticsFw, 0.78 + causticsFw, causticsN);
      float peakBand =
        smoothstep(0.92 - causticsFw, 0.92 + causticsFw, causticsN);
      // Wider AA floor for the foam threshold — where disturbance is
      // locally smooth its gradient is small, and the default floor
      // gives a ~1 px AA edge that aliases along noise contours.
      float foamThreshFw = max(distFw, 0.015);
      float noiseFoam =
        smoothstep(1.05 - foamThreshFw, 1.05 + foamThreshFw, disturbance);
      // Always-on solid foam slice right at the shore, so there's a
      // continuous minimum foam band regardless of whether the local
      // noise happens to peak. Width widens with the wave crest, and
      // scales with cliff steepness to keep a visible band on 2+
      // level cliffs.
      float minFoamDepth = (0.015 + 0.015 * crestFactor) * gradScale;
      float minFoamFarEdge = max(fwidth(depth), 0.002);
      float minFoam = 1.0 -
        smoothstep(
          minFoamDepth - minFoamFarEdge,
          minFoamDepth + minFoamFarEdge,
          depth);
      // Union: the textured noiseFoam extends further when the wave
      // pushes disturbance up; the minFoam layer guarantees a solid
      // band underneath. (Unit ripples already feed into causticsN
      // above, so they reach foam through the noiseFoam path.)
      float foamBand = max(minFoam, noiseFoam);
      float caustics =
        outerBand * 0.12 + innerBand * 0.20 + peakBand * 0.30;

      color = mix(color, WATER_CAUSTICS, caustics * waterEdge * 0.40);
      color = mix(color, WATER_FOAM, foamBand * waterEdge * 0.75);

      // Dry-side effects apply where water isn't covering. dryMask is the
      // inverse of waterEdge so wet sand and stripes blend smoothly
      // through the shore instead of snapping on at the threshold.
      float dryMask = 1.0 - waterEdge;
      if (waterViewMode == 2 && rawWater > 0.001) {
        float stripe =
          step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) * 0.08));
        vec3 indicator = vec3(0.25, 0.45, 0.60);
        color = mix(color, indicator, 0.35 * stripe * dryMask);
      }
      // Wet sand: land recently touched by a wave stays visibly damp for
      // a long time before fully drying. Use an exponential decay of
      // "time since the wave last peaked here" so the darkening persists
      // across multiple wave cycles instead of flipping on/off every 2s.
      if (rawWater > 0.001) {
        // Max depth this pixel could reach at a wave crest.
        float peakWaveBonus = 0.04 + 0.025;
        float peakDepth = (rawWater + tide + peakWaveBonus) - waterGroundH;
        float inReach = smoothstep(0.0, 0.02, peakDepth);
        // Wider "wet zone" extends further from the waterline than before.
        float closeToShore = 1.0 - smoothstep(0.0, 0.15, -depth);
        // Time since wave peaked here (cyclic 0..1 per wave period). Must
        // mirror the primary wave phase used in waterWaveOffset.
        const float PI2 = 6.2831853;
        float wavePhase =
          time * (PI2 / 4.0) + vWorldPos.x * 0.6 + vWorldPos.y * 0.4;
        float sincePeak =
          fract((wavePhase - 1.5708) * (1.0 / 6.2831));
        // Very slow decay: exp(-sincePeak * 0.35) stays in [0.70, 1.0]
        // across the full cycle, so darkening is essentially always on
        // with just a gentle pulse at each wave arrival.
        float damp = exp(-sincePeak * 0.35);
        float wetSand = inReach * closeToShore * damp * dryMask;
        color *= 1.0 - 0.28 * wetSand;
      }
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

const rampAllowed = (cliffMask: CliffMask, x: number, y: number) => {
  {
    const a = cliffMask[y - 1]?.[x];
    const b = cliffMask[y + 1]?.[x];
    if (a !== "r" && b !== "r" && a !== b) return true;
  }
  {
    const a = cliffMask[y]?.[x - 1];
    const b = cliffMask[y]?.[x + 1];
    if (a !== "r" && b !== "r" && a !== b) return true;
  }
  {
    const a = cliffMask[y - 1]?.[x - 1];
    const b = cliffMask[y + 1]?.[x + 1];
    if (a !== "r" && b !== "r" && a !== b) return true;
  }
  {
    const a = cliffMask[y - 1]?.[x + 1];
    const b = cliffMask[y + 1]?.[x - 1];
    if (a !== "r" && b !== "r" && a !== b) return true;
  }
  return false;
};

export class Terrain2D extends Mesh {
  masks: TerrainMasks;
  tiles: { color: string }[];
  declare material: ShaderMaterial;

  constructor(masks: TerrainMasks, tiles: { color: string }[]) {
    const w = masks.cliff[0].length * 2;
    const h = masks.cliff.length * 2;
    const geometry = new PlaneGeometry(w, h);
    geometry.translate(w / 2, h / 2, 0);

    const heightTex = buildHeightTexture(masks.cliff);
    const cliffTex = buildCliffTexture(masks.cliff);
    const tileColorTex = buildTileColorTexture(masks.groundTile, tiles);
    const waterTex = buildWaterTexture(masks.water);

    const material = new ShaderMaterial({
      uniforms: {
        heightMap: { value: heightTex },
        cliffMap: { value: cliffTex },
        tileColorMap: { value: tileColorTex },
        waterMap: { value: waterTex },
        texelSize: { value: new Vector2(1 / w, 1 / h) },
        waterViewMode: { value: 1 },
        time: { value: 0 },
        waterRippleCount: waterRippleUniforms.waterRippleCount,
        waterRipples: waterRippleUniforms.waterRipples,
      },
      vertexShader,
      fragmentShader,
      depthWrite: false,
      side: 2,
    });

    super(geometry, material);
    this.masks = masks;
    this.tiles = tiles;
  }

  private rebuildTextures() {
    const uniforms = this.material.uniforms;

    uniforms.heightMap.value.dispose();
    uniforms.cliffMap.value.dispose();
    uniforms.tileColorMap.value.dispose();
    uniforms.waterMap.value.dispose();

    uniforms.heightMap.value = buildHeightTexture(this.masks.cliff);
    uniforms.cliffMap.value = buildCliffTexture(this.masks.cliff);
    uniforms.tileColorMap.value = buildTileColorTexture(
      this.masks.groundTile,
      this.tiles,
    );
    uniforms.waterMap.value = buildWaterTexture(this.masks.water);

    const w = this.masks.cliff[0].length * 2;
    const h = this.masks.cliff.length * 2;
    uniforms.texelSize.value.set(1 / w, 1 / h);
  }

  getCliff(x: number, y: number) {
    return Math.floor(getCliffHeight(x * 2, y * 2, this.masks.cliff));
  }

  /** Returns the raw water-mask value (integer * WATER_LEVEL_SCALE). 0 = no water. */
  getWater(x: number, y: number) {
    return this.masks.water[y]?.[x] ?? 0;
  }

  /** Sets the water mask cell (raw integer value, 0 = no water). */
  setWater(x: number, y: number, value: number) {
    if (this.masks.water[y]?.[x] === undefined) return;
    this.masks.water[y][x] = Math.max(0, Math.round(value));
    this.rebuildTextures();
  }

  /** Overwrites the entire water mask in one pass (for bulk operations). */
  fillWater(value: number) {
    const v = Math.max(0, Math.round(value));
    for (const row of this.masks.water) {
      for (let x = 0; x < row.length; x++) row[x] = v;
    }
    this.rebuildTextures();
  }

  setWaterViewMode(mode: 0 | 1 | 2) {
    this.material.uniforms.waterViewMode.value = mode;
  }

  setTime(time: number) {
    this.material.uniforms.time.value = time;
  }

  setCliff(x: number, y: number, value: number | "r") {
    if (value === "r") {
      if (this.masks.cliff[y][x] === "r") value = this.getCliff(x, y);
      else if (!rampAllowed(this.masks.cliff, x, y)) return;
    } else {
      if (value < 0) value = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          if (
            this.masks.cliff[y + dy]?.[x + dx] === "r" &&
            !rampAllowed(this.masks.cliff, x + dx, y + dy)
          ) {
            this.masks.cliff[y][x] = getCliffHeight(
              (x + dx) * 2,
              (y + dy) * 2,
              this.masks.cliff,
            );
          }
        }
      }
    }

    this.masks.cliff[y][x] = value;
    this.rebuildTextures();
  }

  setGroundTile(x: number, y: number, value: number) {
    this.masks.groundTile[y][x] = value;
    this.rebuildTextures();
  }

  load(
    masks: TerrainMasks,
    tiles: { color: string }[],
  ) {
    this.masks = masks;
    this.tiles = tiles;

    const w = masks.cliff[0].length * 2;
    const h = masks.cliff.length * 2;
    const oldSize = this.material.uniforms.texelSize.value;
    if (1 / w !== oldSize.x || 1 / h !== oldSize.y) {
      this.geometry.dispose();
      const geometry = new PlaneGeometry(w, h);
      geometry.translate(w / 2, h / 2, 0);
      this.geometry = geometry;
    }

    this.rebuildTextures();
  }
}
