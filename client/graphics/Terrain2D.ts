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
  WATER_SHADER_SUBMERGE_FN,
} from "./waterShader.ts";
import { waterRippleUniforms } from "./waterRipples.ts";
import { cliffDefs } from "@/shared/data.ts";

export type Cliff = number | "r";
export type CliffMask = Cliff[][];
export type WaterMask = number[][];

export type TileDef = {
  color: string;
  strength: number;
  noiseFreq: number;
  noiseAmp: number;
};

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

/** Raw cliff distance field at 4× resolution. Exported for reuse in doodad proximity. */
export const buildCliffDistanceField = (
  cliffMask: CliffMask,
): { dist: Float32Array; w: number; h: number; scale: number } => {
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

  return { dist, w, h, scale };
};

export const buildCliffTexture = (cliffMask: CliffMask): DataTexture => {
  const { dist, w, h } = buildCliffDistanceField(cliffMask);
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
      data[idx + 3] = tileIndex;
    }
  }
  const tex = new DataTexture(data, w, h, RGBAFormat, UnsignedByteType);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};

/**
 * 1×N RGBA float lookup of per-tile field knobs:
 * R = influence radius (0.5 + strength*0.5, in tile-units),
 * G = noise frequency, B = noise amplitude (radius perturbation).
 * Sampled in the shader at u = (tileIndex + 0.5) / N.
 */
const buildTileFieldTexture = (tiles: TileDef[]): DataTexture => {
  const n = Math.max(tiles.length, 1);
  const data = new Float32Array(n * 4);
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    data[i * 4] = 0.5 + t.strength * 0.5;
    data[i * 4 + 1] = t.noiseFreq;
    data[i * 4 + 2] = t.noiseAmp;
    data[i * 4 + 3] = 0;
  }
  const tex = new DataTexture(data, n, 1, RGBAFormat, FloatType);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
};

const buildCliffColorTexture = (
  cliffTile: number[][],
  defs: { colorLight: number; colorDark: number }[],
): DataTexture => {
  const h = cliffTile.length * 2;
  const w = cliffTile[0].length * 2;
  // 6 channels per texel: light RGB + dark RGB, packed into two rows
  // Use a simpler approach: RGBA where RGB = light color, A = index
  // Then a second sample for dark. Pack both into one texture by doubling height.
  const totalH = h * 2; // bottom half = light, top half = dark
  const data = new Uint8Array(w * totalH * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = cliffTile[Math.floor(y / 2)]?.[Math.floor(x / 2)] ?? 0;
      const def = defs[idx] ?? defs[0];
      const light = def.colorLight;
      const dark = def.colorDark;
      // Bottom half: light
      const li = (y * w + x) * 4;
      data[li] = (light >> 16) & 0xff;
      data[li + 1] = (light >> 8) & 0xff;
      data[li + 2] = light & 0xff;
      data[li + 3] = idx;
      // Top half: dark
      const di = ((y + h) * w + x) * 4;
      data[di] = (dark >> 16) & 0xff;
      data[di + 1] = (dark >> 8) & 0xff;
      data[di + 2] = dark & 0xff;
      data[di + 3] = idx;
    }
  }
  const tex = new DataTexture(data, w, totalH, RGBAFormat, UnsignedByteType);
  tex.needsUpdate = true;
  return tex;
};

export type DoodadPoint = { x: number; y: number; radius: number };

/**
 * Builds a proximity field at 2× cliff-mask resolution.  Each texel stores
 * a 0-255 value representing how close it is to a doodad.  Larger-radius
 * doodads have a wider influence.  The coordinate system matches the
 * cliff-mask (Y-flipped from world space).
 */
/**
 * Builds a combined proximity field (doodads + cliff edges) at 2× cliff-mask
 * resolution. Each texel stores the max proximity (0–255) from either source.
 */
const buildDoodadTexture = (
  cliffMask: CliffMask,
  doodads: DoodadPoint[],
): DataTexture => {
  const h = cliffMask.length * 2;
  const w = cliffMask[0].length * 2;
  const data = new Uint8Array(w * h);

  // Build cliff edge proximity at 2× resolution.
  // Use the 4× cliff distance field to identify edge texels (dist < 0.5),
  // then compute our own wider distance field from those edges.
  const cliffField = buildCliffDistanceField(cliffMask);
  const cliffInfluence = 7; // texels at 2× (~3.5 world units)

  // Mark edge texels at 2× by checking if any sub-texel in the 4× field is near an edge
  const cliffEdge = new Uint8Array(w * h);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      let near = false;
      for (let sy = 0; sy < 2 && !near; sy++) {
        for (let sx = 0; sx < 2 && !near; sx++) {
          if (
            cliffField.dist[(py * 2 + sy) * cliffField.w + px * 2 + sx] < 0.5
          ) {
            near = true;
          }
        }
      }
      if (near) cliffEdge[py * w + px] = 1;
    }
  }

  // Distance field from edge texels at 2× with wider radius
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      let minDist = cliffInfluence + 1;
      if (cliffEdge[py * w + px]) {
        minDist = 0;
      } else {
        const x0 = Math.max(0, px - cliffInfluence);
        const x1 = Math.min(w - 1, px + cliffInfluence);
        const y0 = Math.max(0, py - cliffInfluence);
        const y1 = Math.min(h - 1, py + cliffInfluence);
        for (let sy = y0; sy <= y1; sy++) {
          for (let sx = x0; sx <= x1; sx++) {
            if (!cliffEdge[sy * w + sx]) continue;
            const ddx = px - sx;
            const ddy = py - sy;
            const d = Math.sqrt(ddx * ddx + ddy * ddy);
            if (d < minDist) minDist = d;
          }
        }
      }
      if (minDist <= cliffInfluence) {
        const t = Math.max(0, 1 - minDist / cliffInfluence);
        // Remap so t stays at 1.0 for the first 15% of the range, then decays
        const t2 = Math.min(1, t / 0.92);
        const val = t2 * t2 * t2 * 0.7;
        const byte = Math.round(val * 255);
        if (byte > data[py * w + px]) data[py * w + px] = byte;
      }
    }
  }

  // Doodad proximity
  for (const { x, y, radius } of doodads) {
    const tx = x * 2;
    const ty = y * 2;
    const influence = Math.max(6, radius * 10);
    // 0.25→0.82, 0.5→0.9, 0.75→0.95, 1.0→1.0
    const strength = Math.min(1, 0.6 + Math.sqrt(radius) * 0.4);
    const r = Math.ceil(influence);
    const x0 = Math.max(0, Math.floor(tx) - r);
    const x1 = Math.min(w - 1, Math.ceil(tx) + r);
    const y0 = Math.max(0, Math.floor(ty) - r);
    const y1 = Math.min(h - 1, Math.ceil(ty) + r);
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const ddx = px + 0.5 - tx;
        const ddy = py + 0.5 - ty;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);
        // Ring shape: peaks at ringDist from center, suppressed at center
        const ringDist = radius * 3;
        const ringVal = Math.exp(-3 * Math.abs(dist - ringDist) / influence);
        // Suppress center: 0 at center, ramps up to 1 at ringDist
        const centerSuppress = Math.min(1, dist / ringDist);
        const val = ringVal * centerSuppress * strength * 0.75;
        const byte = Math.round(val * 255);
        const idx = py * w + px;
        if (byte > data[idx]) data[idx] = byte;
      }
    }
  }

  const tex = new DataTexture(data, w, h, RedFormat, UnsignedByteType);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
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
  // cache buster: d
  uniform sampler2D heightMap;
  uniform sampler2D cliffMap;
  uniform sampler2D tileColorMap;
  uniform sampler2D tileFieldMap;
  uniform float tileCount;
  uniform sampler2D doodadMap;
  uniform sampler2D waterMap;
  uniform vec2 texelSize;
  uniform sampler2D cliffColorMap;
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
  ${WATER_SHADER_SUBMERGE_FN}

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

  // Polynomial smooth-min — Iñigo Quílez. Smaller k → harder min.
  float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
  }

  // Soft tile field. Each pixel surveys the 4 nearest tile centers
  // (Voronoi quad) — sufficient because at strength≤1 + amp≤0.4, the
  // effective radius is ≤1.4 and any tile center beyond the quad is at
  // distance ≥ 1.5, so it can never win or be a near-miss runner-up:
  //   1. Per-quad-corner: distance to center, perturbed radius, tile
  //      color and index.
  //   2. Per candidate: smooth-min distance against every same-type
  //      sibling in the quad. Same-type tiles merge into one distance
  //      field — this gives rounded corners and hourglass crossings.
  //   3. Best (radius - softDist) wins; AA blend against runner-up of
  //      a different type.
  vec3 softTileColor(vec2 wp) {
    // Anchor at the bottom-left of the 4 surrounding tile centers.
    vec2 quadId = floor(wp - 0.5);

    float tIdx[4];
    float dist[4];
    float rad[4];
    vec3 col[4];

    for (int j = 0; j < 4; j++) {
      int dx = j - (j / 2) * 2;
      int dy = j / 2;
      vec2 nbrId = quadId + vec2(float(dx), float(dy));
      vec2 nbrCenter = nbrId + 0.5;
      vec2 nbrUv = nbrCenter * 2.0 * texelSize;

      vec4 nbrTexel = texture2D(tileColorMap, nbrUv);
      float nbrIdx = nbrTexel.a * 255.0;

      vec2 fieldUv = vec2((nbrIdx + 0.5) / tileCount, 0.5);
      vec3 field = texture2D(tileFieldMap, fieldUv).rgb;

      // Per-type noise (function of wp only). Per-instance noise here
      // would make sibling same-type tiles disagree on rad, putting a
      // tangent kink at every same-type boundary and making the runner-
      // up's secondInf jump as the quad shifts to a different same-type
      // instance at Voronoi-cell boundaries.
      float n = vnoise(wp * field.g + vec2(nbrIdx * 27.3, nbrIdx * 41.1)) -
                0.5;
      tIdx[j] = nbrIdx;
      dist[j] = distance(wp, nbrCenter);
      rad[j] = field.r + n * field.b;
      col[j] = nbrTexel.rgb;
    }

    // Roundness knob. 0 = boxy cells, 0.5–0.7 = bulbous, >1.0 = gooey.
    const float k = 0.65;
    float bestInf = -1e9;
    vec3 bestCol = vec3(0.0);
    float bestIdx = -1.0;
    float secondInf = -1e9;
    vec3 secondCol = vec3(0.0);

    for (int i = 0; i < 4; i++) {
      float sd = dist[i];
      for (int j = 0; j < 4; j++) {
        if (j == i) continue;
        if (abs(tIdx[j] - tIdx[i]) > 0.5) continue;
        sd = smin(sd, dist[j], k);
      }
      float inf = rad[i] - sd;

      if (inf > bestInf) {
        if (abs(tIdx[i] - bestIdx) > 0.5) {
          secondInf = bestInf;
          secondCol = bestCol;
        }
        bestInf = inf;
        bestCol = col[i];
        bestIdx = tIdx[i];
      } else if (abs(tIdx[i] - bestIdx) > 0.5 && inf > secondInf) {
        secondInf = inf;
        secondCol = col[i];
      }
    }

    float gap = bestInf - secondInf;
    // Clamp aa to a max so a fwidth(gap) spike at a window-shift
    // discontinuity (where secondInf jumps as the 4-quad swaps a
    // smin-dominating same-type instance for another) can't collapse
    // the smoothstep into a 1-px band of loser color.
    float aa = clamp(fwidth(gap), 0.0005, 0.05);
    // Center the AA on gap=0 so the boundary itself is a 50/50 blend and
    // each side ramps smoothly into its own color. A one-sided smoothstep
    // here would invert the transition (render secondCol *at* the boundary).
    float t = smoothstep(-aa, aa, gap);
    // Suppress the runner-up entirely when it's outside its own blob
    // (negative influence). The 3×3 window can swap which far-away
    // tile holds the runner-up slot at every cell-grid boundary, and
    // that jump makes fwidth(gap) spike — without this gate it leaks
    // a 1-px band of the loser color far from any real transition.
    float overlap = smoothstep(-0.05, 0.05, secondInf);
    return mix(bestCol, mix(secondCol, bestCol, t), overlap);
  }

  void main() {
    vec2 wp = vWorldPos;
    vec3 tileColor = softTileColor(wp);

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
    vec2 cliffUv = vUv * vec2(1.0, 0.5);
    vec3 rockLight = texture2D(cliffColorMap, cliffUv).rgb;
    vec3 rockDark = texture2D(cliffColorMap, cliffUv + vec2(0.0, 0.5)).rgb;
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

    // Procedural pebbles — small dark stones scattered on dirt tiles.
    // Drawn before grass so blade tips overlay pebbles at dirt/grass seams.
    {
      float pebCellSize = 0.3;
      // Rotate the cell grid off the tile axes so the periodic structure
      // isn't aligned with anything else on screen — kills the row/column
      // pattern that was visible at axis-aligned spacing.
      const float pebCosR = 0.934;
      const float pebSinR = 0.358;
      vec2 wpRot = vec2(pebCosR * wp.x + pebSinR * wp.y,
                        -pebSinR * wp.x + pebCosR * wp.y);
      vec2 pebCellPos = wpRot / pebCellSize;

      float winAlpha = 0.0;
      vec3 winColor = vec3(0.0);

      // 4-quad: pebble radius (~0.13 cell-units) is well under the
      // half-cell, so pebbles never extend past their own cell — the 4
      // closest cells are sufficient.
      vec2 pebQuadId = floor(pebCellPos - 0.5);
      for (int j = 0; j < 4; j++) {
        int dx = j - (j / 2) * 2;
        int dy = j / 2;
        vec2 cellId = pebQuadId + vec2(float(dx), float(dy));
        vec2 cellUv = pebCellPos - cellId;

        float h0 = hash(cellId);

        float h1 = hash(cellId + vec2(127.1, 311.7));
        float h2 = hash(cellId + vec2(269.5, 183.3));
        float h3 = hash(cellId + vec2(531.7, 213.1));
        float h4 = hash(cellId + vec2(317.9, 149.3));

        // Full-cell jitter — no axis-aligned dead zone between cells.
        vec2 pebCenter = vec2(h1, h2);

        vec2 rootWorldRot = (cellId + pebCenter) * pebCellSize;
        vec2 rootWorld = vec2(
          pebCosR * rootWorldRot.x - pebSinR * rootWorldRot.y,
          pebSinR * rootWorldRot.x + pebCosR * rootWorldRot.y);
        vec2 rootUv = rootWorld * 2.0 * texelSize;

        // Low-frequency density octave — creates patches of denser/sparser
        // pebbles instead of a uniform sprinkle. Period ~3 tile-units.
        float densityNoise = vnoise(rootWorld * 0.35);
        float threshold = 0.05 + densityNoise * 0.85;
        if (h0 > threshold) continue;
        float rootTile = texture2D(tileColorMap, rootUv).a * 255.0;
        if (abs(rootTile - 5.0) > 0.5) continue;

        float rootCliff = texture2D(cliffMap, rootUv).r * 2.0;
        if (rootCliff < 0.3) continue;
        float rootWaterLevel = texture2D(waterMap, rootUv).r;
        float rootHeight = texture2D(heightMap, rootUv).r;
        if (rootWaterLevel > rootHeight) continue;

        // Pebble = rotated, slightly elongated ellipse. Sizes in cell-units
        // (multiply by pebCellSize for tile-units): 0.08–0.14 → ~0.024–0.042
        // tile-radius, similar visual scale to a grass blade's width.
        float pebRx = 0.08 + h3 * 0.06;
        float pebRy = pebRx * (0.7 + h4 * 0.5);
        float angle = h0 * 6.2831853;
        float ca = cos(angle);
        float sa = sin(angle);

        vec2 d = cellUv - pebCenter;
        vec2 dr = vec2(d.x * ca - d.y * sa, d.x * sa + d.y * ca);
        float dist = length(vec2(dr.x / pebRx, dr.y / pebRy));

        float px = max(fwidth(dist), 0.0001);
        float alpha = 1.0 - smoothstep(1.0 - px, 1.0 + px, dist);
        if (alpha < 0.01) continue;

        // Stone tone: brown-gray, per-pebble brightness variation, plus
        // a subtle upper-left → lower-right gradient to suggest roundness.
        float tone = 0.55 + h2 * 0.45;
        vec3 stoneColor = vec3(0.42, 0.32, 0.22) * tone;
        float light = 1.0 - 0.25 *
          (dr.x / max(pebRx, pebRy) + dr.y / max(pebRx, pebRy));
        stoneColor *= clamp(light, 0.7, 1.2);
        stoneColor *= 0.26 + smoothH * 0.37;

        if (alpha > winAlpha) {
          winAlpha = alpha;
          winColor = stoneColor;
        }
      }

      if (winAlpha > 0.01) {
        color = mix(color, winColor, winAlpha);
      }
    }

    // Procedural grass — blades rooted in grass tiles can extend over neighbors
    {
      float cellSize = 0.55;
      float bladeScale = 1.6;
      float grassScale = 1.3;

      vec2 cellPos = wp / cellSize;

      float winAlpha = 0.0;
      vec3 winColor = vec3(0.0);

      // 4-quad: the 4 closest clump cells to the pixel. Max blade extent
      // (~0.88 cell-units) is short enough that blades rooted outside
      // this quad effectively never reach the pixel — they were
      // contributing only edge-case slivers in the old 9-cell window.
      vec2 quadId = floor(cellPos - 0.5);
      for (int nyi = 0; nyi < 4; nyi++) {
      int nx = nyi - (nyi / 2) * 2;
      int nyv = nyi / 2;
      vec2 cellId = quadId + vec2(float(nx), float(nyv));
      vec2 cellUv = cellPos - cellId;

      float h0 = hash(cellId);
      float h1 = hash(cellId + vec2(127.1, 311.7));
      float h2 = hash(cellId + vec2(269.5, 183.3));

      vec2 clumpCenter = vec2(0.2 + h1 * 0.6, 0.1 + h2 * 0.5);

      vec2 rootWorld = (cellId + clumpCenter) * cellSize;
      vec2 rootUv = rootWorld * 2.0 * texelSize;

      float featureProx = texture2D(doodadMap, rootUv).r;
      float grassNoise = vnoise(rootWorld * 0.8) * 0.5 + 0.5;
      float proximity = clamp(featureProx + grassNoise * 0.12, 0.0, 1.0);

      float rootTile = texture2D(tileColorMap, rootUv).a * 255.0;
      bool isDarkGrass = rootTile > 3.5 && rootTile < 4.5;
      if (rootTile > 0.5 && !isDarkGrass) continue;
      float densityBoost = isDarkGrass ? 0.05 : 0.0;
      if (h0 >= proximity * proximity * 0.9 + 0.02 + densityBoost) continue;
      // Ban roots on cliff faces using cliff texture directly
      float rootCliff = texture2D(cliffMap, rootUv).r * 2.0;
      if (rootCliff < 0.3) continue;
      float rootWaterLevel = texture2D(waterMap, rootUv).r;
      float rootHeight = texture2D(heightMap, rootUv).r;
      if (rootWaterLevel > rootHeight) continue;

      vec2 d = (cellUv - clumpCenter) / grassScale * vec2(1.0, 1.1);

      float sizeBoost = 0.6 + proximity * 0.4;
      float baseH = (0.35 + h1 * 0.2) * bladeScale * sizeBoost;

      float px = fwidth(cellUv.x);
      // Accumulate blade coverage and color — blades within a clump overlap
      float clumpAlpha = 0.0;
      vec3 clumpColor = vec3(0.0);

      // 4 or 5 blades, split into left fan (2-3) and right fan (2-3)
      float hBlades = hash(cellId + vec2(531.7, 213.1));
      float hSplit = hash(cellId + vec2(317.9, 149.3));
      int totalBlades = hBlades < 0.2 ? 4 : 5;
      int leftCount = totalBlades == 4 ? 2 : 2 + int(hSplit * 1.99);

      for (int b = 0; b < 5; b++) {
        if (b >= totalBlades) break;

        // Fan assignment follows blade order — no swap
        bool isLeft = b < leftCount;
        int fanSize = isLeft ? leftCount : totalBlades - leftCount;
        int fanIdx = isLeft ? b : (fanSize - 1) - (b - leftCount);

        float bHash1 = hash(cellId + float(b) * 93.1);
        float bHash2 = hash(cellId + float(b) * 41.7);
        float bHash3 = hash(cellId + float(b) * 137.3);

        // fanPos for height: 0=outermost, 1=innermost (lead=tallest)
        float fanPos = float(fanIdx) / max(float(fanSize - 1), 1.0);

        // Length: lead blade tallest, outer blades shorter.
        // Smaller fans have a narrower length range to avoid big jumps.
        float minLen = fanSize == 2 ? 0.55 : 0.35;
        float maxLen = fanSize == 2 ? 0.9 : 1.0;
        float lengthMul = mix(minLen, maxLen, fanPos) + (bHash1 - 0.5) * 0.1;
        lengthMul = clamp(lengthMul, 0.3, 1.0);
        float bladeH = baseH * lengthMul;

        // X position follows render order (left to right)
        // Swap x-position at the fan transition
        int xPos = b;
        if (b == leftCount - 1) xPos = leftCount;
        else if (b == leftCount) xPos = leftCount - 1;
        float baseOffset = (float(xPos) - float(totalBlades - 1) * 0.5) * 0.04;
        baseOffset += (bHash2 - 0.5) * 0.02;
        vec2 bladeD = d - vec2(baseOffset, 0.0);

        // Angle uses original blade position (not reversed fanIdx)
        // so angles always progress outward within each fan
        int origFanIdx = isLeft ? b : b - leftCount;
        float anglePos = float(origFanIdx) / max(float(fanSize - 1), 1.0);
        float maxAngle = 0.4 + h1 * 0.3;
        float targetAngle;
        if (isLeft) {
          // ~135° to ~100°
          targetAngle = mix(-maxAngle * 0.95, -maxAngle * 0.45, anglePos);
        } else {
          // ~80° to ~45°
          targetAngle = mix(maxAngle * 0.25, maxAngle * 0.95, anglePos);
        }
        targetAngle += (bHash3 - 0.5) * 0.08;

        // Blades start near-vertical and curve to their target angle
        // Scale curve with blade length so short blades don't sweep far
        float angle = targetAngle * 0.1;
        float curve = (targetAngle * 0.9 + (bHash2 - 0.5) * 0.06) * lengthMul;

        float ca = cos(angle);
        float sa = sin(angle);
        vec2 db = vec2(bladeD.x*ca - bladeD.y*sa, bladeD.x*sa + bladeD.y*ca);

        float t = db.y / max(bladeH, 0.001);
        if (t < 0.0 || t > 1.15) continue;

        db.x -= curve * mix(t * t, t, 0.3);

        // Compensate width for blade lean (rotation + curve)
        float curveSlope = curve * mix(2.0 * min(t, 1.0), 1.0, 0.3);
        float leanCompensation = sqrt(1.0 + (sa / max(ca, 0.01) + curveSlope) * (sa / max(ca, 0.01) + curveSlope));

        // Capsule blade: gentle taper + semicircular tip
        float baseW = 0.04 * bladeScale * sizeBoost * (0.55 + lengthMul * 0.45) * leanCompensation;
        float taper = mix(1.0, 0.25, min(t, 1.0) * min(t, 1.0));
        float w = baseW * taper;
        // Past the tip: measure 2D distance for semicircular cap
        float dy = max(0.0, t - 1.0) * bladeH;
        float dist = length(vec2(db.x, dy));

        float alpha = 1.0 - smoothstep(w - px, w + px, dist);
        alpha *= step(0.0, t);

        if (alpha > 0.01) {
          // Left fan: outer=lighter, lead=darker
          // Right fan: lead=darker, outer=lighter
          // Both fans: outer=lighter, lead=darker
          // Left fan's lead slightly lighter than right fan's lead
          float baseBright = isLeft ? 1.08 : 0.92;
          float brightness = baseBright + (1.0 - fanPos) * 0.25;
          float darkMul = isDarkGrass ? 0.55 : 1.0;
          float r = (8.0 + h0 * 12.0) / 255.0 * brightness * darkMul;
          float g = (30.0 + h1 * 25.0) / 255.0 * brightness * darkMul;
          vec3 bladeCol = vec3(r, g, 0.0) * (0.9 + t * 0.1);
          bladeCol *= 0.26 + smoothH * 0.37;

          // Alpha-composite this blade over previous blades
          clumpColor = mix(clumpColor, bladeCol, alpha / max(clumpAlpha + alpha * (1.0 - clumpAlpha), 0.001));
          clumpAlpha = clumpAlpha + alpha * (1.0 - clumpAlpha);
        }
      }

      // Track the winning clump across all neighbors
      if (clumpAlpha > winAlpha) {
        winAlpha = clumpAlpha;
        winColor = clumpColor;
      }
      } // end neighbor loop

      if (winAlpha > 0.01) {
        color = mix(color, winColor, winAlpha);
      }
    }


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
      // Gated on rawWater so dry-land pixels skip the 64-ring loop.
      float ripple = rawWater > 0.001 ? waterRippleSignal(vWorldPos) : 0.0;

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

    // Procedural cattails — rendered after water so they poke out above it.
    // Only the above-water portion is drawn.
    {
      float cattailCellSize = 0.5;
      float cattailScale = 2.1;

      // Water depth at current pixel including tide/wave motion
      float pixelWaterLevel = waterSmooth(vUv);
      float pixelWaterPresence = smoothstep(0.001, 0.05, pixelWaterLevel);
      float pixelTide = waterTideOffset(time);
      float pixelWave = waterWaveOffset(wp, time);
      float pixelDynamicWater = pixelWaterLevel
        + (pixelTide + pixelWave) * pixelWaterPresence;
      float pixelDepth = pixelDynamicWater - smoothH;

      vec2 cattailCellPos = wp / cattailCellSize;

      float cattailWinAlpha = 0.0;
      vec3 cattailWinColor = vec3(0.0);

      // 2×4 window: 4-quad horizontal × 4 rows {pixel-2, -1, 0, +1}.
      // Cattails extend ~1.66 cell-units above and (depth-dependent)
      // below their root, so we need 2 rows below for tall tops and
      // 1 row above for deep-water stems reaching down. Anchor is
      // referenced to the pixel's cell row, not floor(y-0.5), so
      // coverage is consistent regardless of pixel position in cell.
      vec2 cattailQuadId = vec2(
        floor(cattailCellPos.x - 0.5),
        floor(cattailCellPos.y) - 2.0
      );
      for (int nyi = 0; nyi < 8; nyi++) {
      int cnx = nyi - (nyi / 2) * 2;
      int cny = nyi / 2;
      vec2 cattailCellId = cattailQuadId + vec2(float(cnx), float(cny));
      vec2 cattailCellUv = cattailCellPos - cattailCellId;

      float ch0 = hash(cattailCellId + vec2(71.7, 33.1));
      float ch1 = hash(cattailCellId + vec2(193.5, 417.3));
      float ch2 = hash(cattailCellId + vec2(347.1, 251.7));

      // Cell center = waterline point. Check if it's in water.
      vec2 cattailCenter = vec2(0.15 + ch1 * 0.7, 0.1 + ch2 * 0.5);
      vec2 cattailWorldPos = (cattailCellId + cattailCenter) * cattailCellSize;
      vec2 cattailUv = cattailWorldPos * 2.0 * texelSize;

      float cattailWaterLevel = waterSmooth(cattailUv);
      float cattailHeight = heightSmooth(cattailUv);
      float cattailDepth = cattailWaterLevel - cattailHeight;
      if (cattailDepth < 0.1) continue;
      // Ban only if waterline itself is on a cliff face
      float cattailCliffDist = texture2D(cliffMap, cattailUv).r * 2.0;
      if (cattailCliffDist < 0.25) continue;
      // Check slightly below to avoid truncated cattails at shore/cliff
      vec2 belowUv2 = cattailUv - vec2(0.0, texelSize.y * 0.5);
      float belowDepth = waterSmooth(belowUv2) - heightSmooth(belowUv2);
      if (belowDepth < 0.05) continue;
      float belowCliff = texture2D(cliffMap, belowUv2).r * 2.0;
      if (belowCliff < 0.25) continue;

      // Density: base in all water, more in deep water and near cliffs
      float cattailCliffProx = texture2D(doodadMap, cattailUv).r;
      float directCliffProx = 1.0 - smoothstep(0.25, 1.5, cattailCliffDist);
      // Deep water starts contributing at 0.3+, fully at 0.7+
      float depthFactor = smoothstep(0.3, 0.7, cattailDepth);
      float cliffFactor = max(cattailCliffProx, directCliffProx);
      float cattailDensity = depthFactor * 0.25 + cliffFactor * 0.6;
      cattailDensity = clamp(cattailDensity, 0.0, 1.0);
      if (ch0 >= cattailDensity) continue;

      // d.y = 0 at waterline, positive = above water, negative = below
      vec2 cd = (cattailCellUv - cattailCenter) / cattailScale * vec2(1.0, 1.1);

      // Tide/wave for dynamic waterline offset
      float dynTide = waterTideOffset(time);
      float dynWave = waterWaveOffset(cattailWorldPos, time);
      float dynOffset = (dynTide + dynWave) / cattailScale;

      // Ripple signal at this cattail's position (computed once per cell)
      float cattailRipple = cattailDepth > 0.0 ? waterRippleSignal(cattailWorldPos) : 0.0;

      int cattailBladeCount = 1 + int(ch2 * 2.99);
      float cpx = fwidth(cattailCellUv.x);

      float cattailClumpAlpha = 0.0;
      vec3 cattailClumpColor = vec3(0.0);

      for (int cb = 0; cb < 3; cb++) {
        if (cb >= cattailBladeCount) break;

        float cbHash1 = hash(cattailCellId + float(cb) * 57.3);
        float cbHash2 = hash(cattailCellId + float(cb) * 123.7);
        float cbHash3 = hash(cattailCellId + float(cb) * 199.1);

        // Per-blade above-water part sizes
        float aboveStem = 0.1 + cbHash1 * 0.25;
        float headSize = 0.06 + cbHash2 * 0.1;
        float tipSize = 0.08 + cbHash3 * 0.2;
        float aboveTotal = aboveStem + headSize + tipSize;
        // Underwater stem length based on depth
        float belowLen = max(0.25, cattailDepth * 1.5);

        float cattailAngle = (cbHash1 - 0.5) * 0.25;
        float cattailCurve = (cbHash2 - 0.5) * 0.1;

        float cca = cos(cattailAngle);
        float csa = sin(cattailAngle);
        vec2 cdb = vec2(cd.x*cca - cd.y*csa, cd.x*csa + cd.y*cca);

        // Converge blade centers below waterline — offset the centerline, not the width
        float maxOffset = (float(cb) - float(cattailBladeCount - 1) * 0.5) * 0.03;
        float convergeFrac = smoothstep(-belowLen, 0.0, cdb.y);
        cdb.x -= maxOffset * convergeFrac;


        // cdb.y: 0 = waterline, positive = above, negative = below
        if (cdb.y > aboveTotal || cdb.y < -belowLen) continue;

        // Normalized t for curve (0 at bottom, 1 at top)
        float totalLen = aboveTotal + belowLen;
        float ct = (cdb.y + belowLen) / max(totalLen, 0.001);

        cdb.x -= cattailCurve * mix(ct * ct, ct, 0.3);

        // Sway with water waves — more at the tip, none at the root
        cdb.x += dynWave * ct * ct;

        // Ripple sway: water pushes at the base, above-water follows
        // Underwater: moves with the water directly
        // Above water: pushed from base, slight amplification toward tip
        float aboveFrac = max(0.0, cdb.y) / aboveTotal;
        float rippleSway = cdb.y < 0.0
          ? cattailRipple * 0.2
          : cattailRipple * 0.2 * (1.0 + aboveFrac * 0.4);
        cdb.x += rippleSway;

        // aboveT: 0 at waterline, 1 at tip
        float aboveT = cdb.y / aboveTotal;

        // Thin stem — squared off at bottom, tapered at top
        float cattailTaper = smoothstep(aboveTotal, aboveTotal * 0.92, cdb.y);
        // Head bulge in above-water space
        float headStart = aboveStem / aboveTotal;
        float headEnd = (aboveStem + headSize) / aboveTotal;
        float headBulge = step(headStart, aboveT) * step(aboveT, headEnd) * 1.5;
        float cw = (0.012 + headBulge * 0.018) * cattailScale * cattailTaper;

        float cdist = abs(cdb.x);
        float calpha = 1.0 - smoothstep(cw - cpx, cw + cpx, cdist);

        if (calpha > 0.01) {
          float isHead = step(headStart, aboveT) * step(aboveT, headEnd);
          // Per-clump color variation
          // Stems darker in deep water, lighter in shallow
          float depthBias = 1.0 - smoothstep(0.1, 0.8, cattailDepth) * 0.4;
          float stemVar = (ch0 + (cbHash1 - 0.5) * 0.4 - 0.5) * depthBias;
          float headVar = ch1 + (cbHash2 - 0.5) * 0.7 - 0.5;
          vec3 stemCol = vec3(
            (35.0 + stemVar * 60.0)/255.0,
            (85.0 + stemVar * 70.0)/255.0,
            (15.0 + stemVar * 30.0)/255.0
          ) * depthBias;
          vec3 headCol = vec3(
            (100.0 + headVar * 40.0)/255.0,
            (65.0 + headVar * 30.0)/255.0,
            (25.0 + headVar * 15.0)/255.0
          );
          vec3 cattailCol = mix(stemCol, headCol, isHead);
          cattailCol *= (0.3 + ch2 * 0.25) + smoothH * 0.3;

          // Below dynamic waterline: apply water effect
          if (cdb.y < dynOffset) {
            float waterDist = (dynOffset - cdb.y) * cattailCellSize * 2.0;
            float depthT = clamp(cattailDepth * 1.5, 0.0, 1.0);
            cattailCol = applyWaterSubmerge(
              cattailCol, waterDist, depthT, wp, time);
          }

          cattailClumpColor = mix(cattailClumpColor, cattailCol,
            calpha / max(cattailClumpAlpha + calpha * (1.0 - cattailClumpAlpha), 0.001));
          cattailClumpAlpha = cattailClumpAlpha + calpha * (1.0 - cattailClumpAlpha);
        }
      }

      if (cattailClumpAlpha > cattailWinAlpha) {
        cattailWinAlpha = cattailClumpAlpha;
        cattailWinColor = cattailClumpColor;
      }
      } // end cattail neighbor loop

      if (cattailWinAlpha > 0.01) {
        color = mix(color, cattailWinColor, cattailWinAlpha);
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
  tiles: TileDef[];
  doodads: DoodadPoint[];
  onChange?: () => void;
  declare material: ShaderMaterial;

  constructor(
    masks: TerrainMasks,
    tiles: TileDef[],
    doodads: DoodadPoint[] = [],
  ) {
    const w = masks.cliff[0].length * 2;
    const h = masks.cliff.length * 2;
    const geometry = new PlaneGeometry(w, h);
    geometry.translate(w / 2, h / 2, 0);

    const heightTex = buildHeightTexture(masks.cliff);
    const cliffTex = buildCliffTexture(masks.cliff);
    const tileColorTex = buildTileColorTexture(masks.groundTile, tiles);
    const tileFieldTex = buildTileFieldTexture(tiles);
    const doodadTex = buildDoodadTexture(masks.cliff, doodads);
    const waterTex = buildWaterTexture(masks.water);

    const material = new ShaderMaterial({
      uniforms: {
        heightMap: { value: heightTex },
        cliffMap: { value: cliffTex },
        tileColorMap: { value: tileColorTex },
        tileFieldMap: { value: tileFieldTex },
        tileCount: { value: Math.max(tiles.length, 1) },
        doodadMap: { value: doodadTex },
        waterMap: { value: waterTex },
        texelSize: { value: new Vector2(1 / w, 1 / h) },
        cliffColorMap: {
          value: buildCliffColorTexture(masks.cliffTile, cliffDefs),
        },
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
    this.doodads = doodads;
  }

  private rebuildTextures() {
    const uniforms = this.material.uniforms;

    uniforms.heightMap.value.dispose();
    uniforms.cliffMap.value.dispose();
    uniforms.tileColorMap.value.dispose();
    uniforms.tileFieldMap.value.dispose();
    uniforms.cliffColorMap.value.dispose();
    uniforms.doodadMap.value.dispose();
    uniforms.waterMap.value.dispose();

    uniforms.heightMap.value = buildHeightTexture(this.masks.cliff);
    uniforms.cliffMap.value = buildCliffTexture(this.masks.cliff);
    uniforms.tileColorMap.value = buildTileColorTexture(
      this.masks.groundTile,
      this.tiles,
    );
    uniforms.tileFieldMap.value = buildTileFieldTexture(this.tiles);
    uniforms.tileCount.value = Math.max(this.tiles.length, 1);
    uniforms.cliffColorMap.value = buildCliffColorTexture(
      this.masks.cliffTile,
      cliffDefs,
    );
    uniforms.doodadMap.value = buildDoodadTexture(
      this.masks.cliff,
      this.doodads,
    );
    uniforms.waterMap.value = buildWaterTexture(this.masks.water);

    const w = this.masks.cliff[0].length * 2;
    const h = this.masks.cliff.length * 2;
    uniforms.texelSize.value.set(1 / w, 1 / h);
    this.onChange?.();
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

  /** Bulk-update water cells with a single texture rebuild. */
  setWaters(updates: Iterable<[number, number, number]>) {
    let mutated = false;
    for (const [x, y, value] of updates) {
      const row = this.masks.water[y];
      if (!row || row[x] === undefined) continue;
      const v = Math.max(0, Math.round(value));
      if (row[x] === v) continue;
      row[x] = v;
      mutated = true;
    }
    if (mutated) this.rebuildTextures();
  }

  setWaterViewMode(mode: 0 | 1 | 2) {
    this.material.uniforms.waterViewMode.value = mode;
  }

  setTime(time: number) {
    this.material.uniforms.time.value = time;
  }

  /** Bulk-update cliff cells with a single texture rebuild. */
  setCliffs(updates: Iterable<[number, number, number | "r"]>) {
    let mutated = false;
    for (const [x, y, rawValue] of updates) {
      const row = this.masks.cliff[y];
      if (!row || row[x] === undefined) continue;
      let value = rawValue;
      if (value === "r") {
        if (row[x] === "r") value = this.getCliff(x, y);
        else if (!rampAllowed(this.masks.cliff, x, y)) continue;
      } else {
        if (value < 0) value = 0;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            if (
              this.masks.cliff[y + dy]?.[x + dx] === "r" &&
              !rampAllowed(this.masks.cliff, x + dx, y + dy)
            ) {
              row[x] = getCliffHeight(
                (x + dx) * 2,
                (y + dy) * 2,
                this.masks.cliff,
              );
            }
          }
        }
      }
      if (row[x] === value) continue;
      row[x] = value;
      mutated = true;
    }
    if (mutated) this.rebuildTextures();
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

  setGroundTiles(updates: Iterable<[number, number, number]>) {
    let mutated = false;
    for (const [x, y, value] of updates) {
      const row = this.masks.groundTile[y];
      if (!row || row[x] === undefined || row[x] === value) continue;
      row[x] = value;
      mutated = true;
    }
    if (mutated) this.rebuildTextures();
  }

  setDoodads(doodads: DoodadPoint[]) {
    this.doodads = doodads;
    const uniforms = this.material.uniforms;
    uniforms.doodadMap.value.dispose();
    uniforms.doodadMap.value = buildDoodadTexture(this.masks.cliff, doodads);
    this.onChange?.();
  }

  load(
    masks: TerrainMasks,
    tiles: TileDef[],
    doodads: DoodadPoint[] = [],
  ) {
    this.masks = masks;
    this.tiles = tiles;
    this.doodads = doodads;

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
