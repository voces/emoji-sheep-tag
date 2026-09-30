import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  FloatType,
  LinearFilter,
  RedFormat,
  RGBAFormat,
  Shape,
  ShapeGeometry,
} from "three";

export type AnimationData = {
  partCount: number;
  sampleCount: number;
  clipCount: number;
  fps: number;
  clips: Map<string, { index: number; duration: number }>;
  transformTexture: DataTexture;
  opacityTexture: DataTexture;
};

/** Every half float's value, indexed by its bits, so decoding one is a lookup. */
const HALF_FLOATS = (() => {
  const values = new Float32Array(0x10000);
  const bits = new Int32Array(values.buffer);
  for (let h = 0; h < 0x10000; h++) {
    const sign = (h >> 15) & 0x1;
    const exp = (h >> 10) & 0x1f;
    const frac = h & 0x3ff;
    if (exp === 0) {
      if (frac === 0) {
        values[h] = sign ? -0 : 0;
        continue;
      }
      // Subnormal: shift the fraction up until its leading bit is implicit
      let e = -14;
      let m = frac;
      while ((m & 0x400) === 0) {
        m <<= 1;
        e--;
      }
      bits[h] = (sign << 31) | ((e + 127) << 23) | ((m & 0x3ff) << 13);
    } else if (exp === 31) {
      values[h] = frac ? NaN : sign ? -Infinity : Infinity;
    } else {
      bits[h] = (sign << 31) | ((exp - 15 + 127) << 23) | (frac << 13);
    }
  }
  return values;
})();

const float16ToFloat = (h: number): number => HALF_FLOATS[h];

class BinaryReader {
  private view: DataView;
  private pos = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  readU8(): number {
    return this.view.getUint8(this.pos++);
  }

  readU16(): number {
    const v = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }

  readI16(): number {
    const v = this.view.getInt16(this.pos, true);
    this.pos += 2;
    return v;
  }

  readU24(): number {
    const b0 = this.view.getUint8(this.pos++);
    const b1 = this.view.getUint8(this.pos++);
    const b2 = this.view.getUint8(this.pos++);
    return b0 | (b1 << 8) | (b2 << 16);
  }

  readF16(): number {
    return float16ToFloat(this.readU16());
  }

  readF32(): number {
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }

  readString(): string {
    const len = this.readU8();
    const bytes = new Uint8Array(this.view.buffer, this.pos, len);
    this.pos += len;
    return new TextDecoder().decode(bytes);
  }
}

type Point = {
  x: number;
  y: number;
};

type CubicSegment = {
  p0: Point;
  c0: Point;
  c1: Point;
  p1: Point;
};

type ParsedPath = {
  fill: { r: number; g: number; b: number };
  opacity: number;
  playerMask: boolean;
  parentIdx: number | null;
  transformPoint: Point | null;
  segments: CubicSegment[];
  vertexColors: ({ r: number; g: number; b: number } | null)[] | null;
};

type ParsedGroup = {
  parentIdx: number | null;
  transformPoint: Point | null;
};

type ParsedKeyframe = {
  t: number;
  tx?: number;
  ty?: number;
  rot?: number;
  scale?: number;
  opacity?: number;
};

type ParsedClip = {
  name: string;
  duration: number;
  fps: number;
  parts: Map<number, ParsedKeyframe[]>; // key is path index (positive) or -(groupIdx+1) for groups
};

export type LoadedEstb = {
  geometry: BufferGeometry;
  animationData: AnimationData;
  parts: { index: number }[];
  cameras: ParsedCamera[];
};

const intToRgb = (n: number): { r: number; g: number; b: number } => ({
  r: ((n >> 16) & 0xff) / 255,
  g: ((n >> 8) & 0xff) / 255,
  b: (n & 0xff) / 255,
});

const srgbToLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

const sampleBezier = (
  p0: Point,
  c0: Point,
  c1: Point,
  p1: Point,
  t: number,
): Point => {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: mt3 * p0.x + 3 * mt2 * t * c0.x + 3 * mt * t2 * c1.x + t3 * p1.x,
    y: mt3 * p0.y + 3 * mt2 * t * c0.y + 3 * mt * t2 * c1.y + t3 * p1.y,
  };
};

/** How far, in world units, a curve's straight steps may stray from it. */
const FLATNESS = 0.0005;
/** The most straight steps a curve is cut into, however bent. */
const MAX_CURVE_STEPS = 32;

/**
 * How many equal steps keep `seg` within `tolerance` of the curve: flattened
 * so, a cubic strays at most three quarters of its largest control point
 * second difference over the steps squared.
 */
const flatteningSteps = (seg: CubicSegment, tolerance: number) => {
  const bend = Math.max(
    Math.hypot(
      seg.p0.x - 2 * seg.c0.x + seg.c1.x,
      seg.p0.y - 2 * seg.c0.y + seg.c1.y,
    ),
    Math.hypot(
      seg.c0.x - 2 * seg.c1.x + seg.p1.x,
      seg.c0.y - 2 * seg.c1.y + seg.p1.y,
    ),
  );
  return Math.min(
    MAX_CURVE_STEPS,
    Math.max(1, Math.ceil(Math.sqrt(0.75 * bend / tolerance))),
  );
};

const lerpRgb = (
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});

const defaultPropertyValues = { tx: 0, ty: 0, rot: 0, scale: 1, opacity: 1 };

type Property = keyof typeof defaultPropertyValues;
const PROPERTIES: readonly Property[] = ["tx", "ty", "rot", "scale", "opacity"];

/** One property's keyframes: their times and values, in keyframe order. */
type Track = { ts: number[]; vs: number[] };

/** Each property's track among `keyframes`, split out once rather than per sample. */
const tracksOf = (keyframes: readonly ParsedKeyframe[]) =>
  Object.fromEntries(PROPERTIES.map((property) => {
    const ts: number[] = [], vs: number[] = [];
    for (const kf of keyframes) {
      const v = kf[property];
      if (v === undefined) continue;
      ts.push(kf.t);
      vs.push(v);
    }
    return [property, ts.length ? { ts, vs } : undefined];
  })) as Record<Property, Track | undefined>;

/** A track's value at `t`, held at its ends and eased linearly between keys. */
const valueAt = (track: Track | undefined, property: Property, t: number) => {
  if (!track) return defaultPropertyValues[property];
  const { ts, vs } = track;
  if (ts.length === 1) return vs[0];
  let left = 0, right = ts.length - 1;
  for (let i = 0; i < ts.length - 1; i++) {
    if (ts[i] <= t && ts[i + 1] >= t) {
      left = i;
      right = i + 1;
      break;
    }
  }
  if (t <= ts[left]) return vs[left];
  if (t >= ts[right]) return vs[right];
  const dt = ts[right] - ts[left];
  if (dt === 0) return vs[left];
  return vs[left] + (vs[right] - vs[left]) * (t - ts[left]) / dt;
};

const getPivotOffset = (pivot: Point, rot: number, scale: number): Point => {
  if (Math.abs(rot) < 0.0001 && Math.abs(scale - 1) < 0.0001) {
    return { x: 0, y: 0 };
  }
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const rotatedX = pivot.x * scale * cos - pivot.y * scale * sin;
  const rotatedY = pivot.x * scale * sin + pivot.y * scale * cos;
  return { x: pivot.x - rotatedX, y: pivot.y - rotatedY };
};

export type ParsedCamera = {
  x: number;
  y: number;
  size: number;
};

type ParsedEstb = {
  paths: ParsedPath[];
  groups: ParsedGroup[];
  clips: ParsedClip[];
  cameras: ParsedCamera[];
};

const parseCache = new WeakMap<ArrayBuffer, ParsedEstb>();

const parseEstb = (buffer: ArrayBuffer): ParsedEstb => {
  const cached = parseCache.get(buffer);
  if (cached) return cached;
  const r = new BinaryReader(buffer);

  // Read header
  const magic0 = r.readU8();
  const magic1 = r.readU8();
  const magic2 = r.readU8();
  const version = r.readU8();

  if (magic0 !== 0x45 || magic1 !== 0x53 || magic2 !== 0x54) {
    throw new Error("Invalid estb file: bad magic");
  }
  if (version !== 3 && version !== 4) {
    throw new Error(`Unsupported estb version: ${version}`);
  }

  // Read counts
  const pathCount = r.readU16();
  const groupCount = r.readU16();
  const clipCount = r.readU16();
  const cameraCount = version >= 4 ? r.readU16() : 0;

  // Read paths
  const paths: ParsedPath[] = [];
  for (let i = 0; i < pathCount; i++) {
    const flags = r.readU8();
    const playerMask = (flags & 1) !== 0;
    const hasParent = (flags & 2) !== 0;
    const hasTP = (flags & 4) !== 0;
    const hasVC = (flags & 8) !== 0;

    const fill = intToRgb(r.readU24());
    const opacity = r.readU8() / 255;

    const parentIdx = hasParent ? r.readU16() : null;
    const transformPoint = hasTP ? { x: r.readF16(), y: r.readF16() } : null;

    const segmentCount = r.readU16();
    const segments: CubicSegment[] = [];
    for (let s = 0; s < segmentCount; s++) {
      segments.push({
        p0: { x: r.readF16(), y: r.readF16() },
        c0: { x: r.readF16(), y: r.readF16() },
        c1: { x: r.readF16(), y: r.readF16() },
        p1: { x: r.readF16(), y: r.readF16() },
      });
    }

    let vertexColors: ({ r: number; g: number; b: number } | null)[] | null =
      null;
    if (hasVC) {
      vertexColors = [];
      for (let v = 0; v < segmentCount; v++) {
        const c = r.readU24();
        vertexColors.push(c === 0 ? null : intToRgb(c));
      }
    }

    paths.push({
      fill,
      opacity,
      playerMask,
      parentIdx,
      transformPoint,
      segments,
      vertexColors,
    });
  }

  // Read groups
  const groups: ParsedGroup[] = [];
  for (let i = 0; i < groupCount; i++) {
    const flags = r.readU8();
    const hasParent = (flags & 1) !== 0;
    const hasTP = (flags & 2) !== 0;

    const parentIdx = hasParent ? r.readU16() : null;
    const transformPoint = hasTP ? { x: r.readF16(), y: r.readF16() } : null;

    groups.push({ parentIdx, transformPoint });
  }

  // Read clips
  const clips: ParsedClip[] = [];
  for (let i = 0; i < clipCount; i++) {
    const name = r.readString();
    const duration = r.readF32();
    const fps = r.readU8();
    const partCount = r.readU16();

    const parts = new Map<number, ParsedKeyframe[]>();

    for (let p = 0; p < partCount; p++) {
      const partIdx = r.readI16();
      const keyframeCount = r.readU16();

      const keyframes: ParsedKeyframe[] = [];
      for (let k = 0; k < keyframeCount; k++) {
        const t = r.readF16();
        const flags = r.readU8();

        const kf: ParsedKeyframe = { t };
        if (flags & 1) kf.tx = r.readF16();
        if (flags & 2) kf.ty = r.readF16();
        if (flags & 4) kf.rot = r.readF16();
        if (flags & 8) kf.scale = r.readF16();
        if (flags & 16) kf.opacity = r.readF16();

        keyframes.push(kf);
      }

      parts.set(partIdx, keyframes);
    }

    clips.push({ name, duration, fps, parts });
  }

  // Read cameras
  const cameras: ParsedCamera[] = [];
  for (let i = 0; i < cameraCount; i++) {
    cameras.push({ x: r.readF16(), y: r.readF16(), size: r.readF16() });
  }

  const result = { paths, groups, clips, cameras };
  parseCache.set(buffer, result);
  return result;
};

const rgbToHex = (rgb: { r: number; g: number; b: number }): string => {
  const r = Math.round(rgb.r * 255);
  const g = Math.round(rgb.g * 255);
  const b = Math.round(rgb.b * 255);
  return `#${r.toString(16).padStart(2, "0")}${
    g.toString(16).padStart(2, "0")
  }${b.toString(16).padStart(2, "0")}`;
};

/**
 * Convert estb binary to SVG string.
 */
export const estbToSvg = (buffer: ArrayBuffer): string => {
  const { paths } = parseEstb(buffer);

  // Filter out paths with zero opacity
  const visiblePaths = paths.filter((p) => p.opacity > 0);

  // Calculate bounding box (only from visible paths)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const path of visiblePaths) {
    for (const seg of path.segments) {
      for (const pt of [seg.p0, seg.c0, seg.c1, seg.p1]) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      }
    }
  }

  const width = maxX - minX;
  const height = maxY - minY;

  // Flip Y: negate and offset to keep in positive range
  const flipY = (y: number) => -y;
  const viewMinY = flipY(maxY);

  const svgPaths: string[] = [];
  for (const path of visiblePaths) {
    if (path.segments.length === 0) continue;

    // Build path d attribute with flipped Y
    const first = path.segments[0].p0;
    let d = `M ${first.x} ${flipY(first.y)}`;
    for (const seg of path.segments) {
      d += ` C ${seg.c0.x} ${flipY(seg.c0.y)} ${seg.c1.x} ${
        flipY(seg.c1.y)
      } ${seg.p1.x} ${flipY(seg.p1.y)}`;
    }
    d += " Z";

    const fill = rgbToHex(path.fill);
    const opacity = path.opacity < 1 ? ` fill-opacity="${path.opacity}"` : "";
    const playerData = path.playerMask ? ` data-player="true"` : "";
    svgPaths.push(`  <path d="${d}" fill="${fill}"${opacity}${playerData}/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${viewMinY} ${width} ${height}">
${svgPaths.join("\n")}
</svg>`;
};

export const loadEstb = (
  buffer: ArrayBuffer,
  options?: { scale?: number; xOffset?: number; yOffset?: number },
): LoadedEstb => {
  const { paths, groups, clips, cameras } = parseEstb(buffer);
  const scale = options?.scale ?? 1;
  const xOffset = options?.xOffset ?? 0;
  const yOffset = options?.yOffset ?? 0;

  // Build geometry
  const geometry = buildGeometry(paths, scale, 0, 0);

  // Build animation data
  const animationData = buildAnimationData(
    paths,
    groups,
    clips,
    scale,
    xOffset,
    yOffset,
  );

  return {
    geometry,
    animationData,
    parts: paths.map((_, i) => ({ index: i })),
    cameras,
  };
};

const buildGeometry = (
  paths: ParsedPath[],
  scale: number,
  xOffset: number,
  yOffset: number,
): BufferGeometry => {
  const allPositions: number[] = [];
  const allColors: number[] = [];
  const allPartIDs: number[] = [];
  const allPlayerMasks: number[] = [];

  for (let partIdx = 0; partIdx < paths.length; partIdx++) {
    const path = paths[partIdx];
    if (path.segments.length === 0) continue;

    const hasVertexColors = path.vertexColors !== null &&
      path.vertexColors.some((vc) => vc !== null);

    let shape: Shape;
    let pathPoints: Point[] | null = null;
    let pathColors: { r: number; g: number; b: number }[] | null = null;

    if (hasVertexColors && path.vertexColors) {
      const anchorColors = path.vertexColors.map((vc) => vc ?? path.fill);

      const samplesPerSegment = 16;
      pathPoints = [];
      pathColors = [];

      for (let segIdx = 0; segIdx < path.segments.length; segIdx++) {
        const seg = path.segments[segIdx];
        const nextIdx = (segIdx + 1) % path.segments.length;
        const startColor = anchorColors[segIdx];
        const endColor = anchorColors[nextIdx];

        for (let i = 0; i < samplesPerSegment; i++) {
          const t = i / samplesPerSegment;
          pathPoints.push(sampleBezier(seg.p0, seg.c0, seg.c1, seg.p1, t));
          pathColors.push(lerpRgb(startColor, endColor, t));
        }
      }

      shape = new Shape();
      shape.moveTo(pathPoints[0].x * scale, pathPoints[0].y * scale);
      for (let i = 1; i < pathPoints.length; i++) {
        shape.lineTo(pathPoints[i].x * scale, pathPoints[i].y * scale);
      }
      shape.closePath();
    } else {
      shape = new Shape();
      const first = path.segments[0].p0;
      shape.moveTo(first.x * scale, first.y * scale);

      // Each curve in as few straight steps as keep it within the flatness,
      // rather than a fixed many: most of the art's edges are straight or
      // gently bent, and every point costs triangulating
      const tolerance = FLATNESS / scale;
      for (const seg of path.segments) {
        const steps = flatteningSteps(seg, tolerance);
        for (let i = 1; i <= steps; i++) {
          const { x, y } = sampleBezier(
            seg.p0,
            seg.c0,
            seg.c1,
            seg.p1,
            i / steps,
          );
          shape.lineTo(x * scale, y * scale);
        }
      }
      shape.closePath();
    }

    const shapeGeo = new ShapeGeometry(shape);

    const positions = shapeGeo.attributes.position;
    const vertexCount = positions.count;
    const colors = new Float32Array(vertexCount * 3);

    if (hasVertexColors && pathPoints && pathColors) {
      for (let i = 0; i < vertexCount; i++) {
        const vx = positions.getX(i);
        const vy = positions.getY(i);

        let closestIdx = 0;
        let closestDist = Infinity;
        for (let j = 0; j < pathPoints.length; j++) {
          const dx = pathPoints[j].x * scale - vx;
          const dy = pathPoints[j].y * scale - vy;
          const dist = dx * dx + dy * dy;
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = j;
          }
        }

        const color = pathColors[closestIdx];
        colors[i * 3] = srgbToLinear(color.r);
        colors[i * 3 + 1] = srgbToLinear(color.g);
        colors[i * 3 + 2] = srgbToLinear(color.b);
      }
    } else {
      for (let i = 0; i < vertexCount; i++) {
        colors[i * 3] = srgbToLinear(path.fill.r);
        colors[i * 3 + 1] = srgbToLinear(path.fill.g);
        colors[i * 3 + 2] = srgbToLinear(path.fill.b);
      }
    }

    const indices = shapeGeo.index;
    if (indices) {
      for (let i = 0; i < indices.count; i++) {
        const idx = indices.getX(i);
        allPositions.push(
          positions.getX(idx) + xOffset,
          positions.getY(idx) + yOffset,
          positions.getZ(idx),
        );
        allColors.push(
          colors[idx * 3],
          colors[idx * 3 + 1],
          colors[idx * 3 + 2],
        );
        allPartIDs.push(partIdx);
        allPlayerMasks.push(path.playerMask ? 1 : 0);
      }
    } else {
      for (let i = 0; i < vertexCount; i++) {
        allPositions.push(
          positions.getX(i) + xOffset,
          positions.getY(i) + yOffset,
          positions.getZ(i),
        );
        allColors.push(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
        allPartIDs.push(partIdx);
        allPlayerMasks.push(path.playerMask ? 1 : 0);
      }
    }

    shapeGeo.dispose();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(allPositions), 3),
  );
  geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(allColors), 3),
  );
  geometry.setAttribute(
    "playerMask",
    new BufferAttribute(new Float32Array(allPlayerMasks), 1),
  );

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  // Pack partID and sprite-local normalized Y (0=bottom, 1=top) into a single
  // vec2 attribute to stay under the 16-attribute GL limit.
  const bbox = geometry.boundingBox;
  const minY = bbox ? bbox.min.y : 0;
  const range = bbox ? bbox.max.y - minY : 0;
  const inv = range > 0 ? 1 / range : 0;
  const vertexCount = allPositions.length / 3;
  const partInfoData = new Float32Array(vertexCount * 2);
  for (let i = 0; i < vertexCount; i++) {
    partInfoData[i * 2] = allPartIDs[i];
    partInfoData[i * 2 + 1] = (allPositions[i * 3 + 1] - minY) * inv;
  }
  geometry.setAttribute("partInfo", new BufferAttribute(partInfoData, 2));

  return geometry;
};

const buildAnimationData = (
  paths: ParsedPath[],
  groups: ParsedGroup[],
  clips: ParsedClip[],
  scale: number,
  xOffset: number,
  yOffset: number,
): AnimationData => {
  const partCount = paths.length;

  // Always include a "default" clip at index 0 with identity transforms (T-pose)
  const fps = clips.length > 0 ? clips[0].fps : 60;
  const maxDuration = clips.length > 0
    ? Math.max(...clips.map((c) => c.duration))
    : 0;
  const sampleCount = Math.max(1, Math.ceil(maxDuration * fps));
  // +1 for the default clip
  const clipCount = clips.length + 1;

  const pivotOf = (path: ParsedPath): Point => {
    if (path.transformPoint) return path.transformPoint;
    if (path.segments.length === 0) return { x: 0, y: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const seg of path.segments) {
      for (const pt of [seg.p0, seg.c0, seg.c1, seg.p1]) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
    }
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  };

  // What stays the same from sample to sample, worked out once: each part's
  // groups outermost first, where it turns about, and each animation's tracks
  const ancestors = paths.map((path) => {
    const chain: number[] = [];
    for (
      let parentIdx = path.parentIdx;
      parentIdx !== null && parentIdx < groups.length;
      parentIdx = groups[parentIdx].parentIdx
    ) chain.unshift(parentIdx);
    return chain;
  });
  const pivots = paths.map(pivotOf);
  const trackCache = new Map<
    readonly ParsedKeyframe[],
    Record<Property, Track | undefined>
  >();
  const tracks = (keyframes: readonly ParsedKeyframe[] | undefined) => {
    if (!keyframes?.length) return undefined;
    let found = trackCache.get(keyframes);
    if (!found) trackCache.set(keyframes, found = tracksOf(keyframes));
    return found;
  };

  const totalSamples = sampleCount * partCount * clipCount;
  const transformData = new Float32Array(totalSamples * 4);
  const opacityData = new Float32Array(totalSamples);

  // Clip 0 is the "default" clip with identity transforms but using base path opacity
  for (let sampleIdx = 0; sampleIdx < sampleCount; sampleIdx++) {
    for (let partIdx = 0; partIdx < partCount; partIdx++) {
      const dataIdx = partIdx * sampleCount + sampleIdx;
      transformData[dataIdx * 4 + 0] = xOffset;
      transformData[dataIdx * 4 + 1] = yOffset;
      transformData[dataIdx * 4 + 2] = 0; // rot
      transformData[dataIdx * 4 + 3] = 1; // scale
      // Use base path opacity for default clip
      opacityData[dataIdx] = paths[partIdx].opacity;
    }
  }

  // Other clips start at index 1
  for (let clipIdx = 0; clipIdx < clips.length; clipIdx++) {
    const clip = clips[clipIdx];
    const clipOffset = (clipIdx + 1) * partCount * sampleCount;
    const groupTracks = groups.map((_, g) => tracks(clip.parts.get(-(g + 1))));
    const partTracks = paths.map((_, p) => tracks(clip.parts.get(p)));

    for (let sampleIdx = 0; sampleIdx < sampleCount; sampleIdx++) {
      // Shader samples using normalized time t in [0,1], so we bake at normalized time
      // NOT real time. The keyframes are in real seconds, so we scale back.
      const normalizedT = sampleCount > 1 ? sampleIdx / (sampleCount - 1) : 0;
      const t = normalizedT * clip.duration;

      for (let partIdx = 0; partIdx < partCount; partIdx++) {
        const path = paths[partIdx];

        let combinedTx = 0,
          combinedTy = 0,
          combinedRot = 0,
          combinedScale = 1,
          combinedOpacity = 1;

        // Track if any ancestor has opacity keyframes
        let anyAncestorHasOpacityKeyframes = false;

        // Apply ancestor transforms
        for (const groupIdx of ancestors[partIdx]) {
          const ancestorTracks = groupTracks[groupIdx];
          if (!ancestorTracks) continue;
          const aTx = valueAt(ancestorTracks.tx, "tx", t);
          const aTy = valueAt(ancestorTracks.ty, "ty", t);
          const aRot = valueAt(ancestorTracks.rot, "rot", t);
          const aScale = valueAt(ancestorTracks.scale, "scale", t);
          // For opacity: use animated value if keyframes exist, otherwise treat as 1
          // (parent opacity controls children, but only if explicitly animated)
          if (ancestorTracks.opacity) anyAncestorHasOpacityKeyframes = true;
          const aOpacity = ancestorTracks.opacity
            ? valueAt(ancestorTracks.opacity, "opacity", t)
            : 1;

          const pivot = groups[groupIdx].transformPoint ?? { x: 0, y: 0 };
          const pivotOffset = getPivotOffset(pivot, aRot, aScale);

          const cos = Math.cos(aRot);
          const sin = Math.sin(aRot);
          const rotatedTx = combinedTx * cos - combinedTy * sin;
          const rotatedTy = combinedTx * sin + combinedTy * cos;

          combinedTx = rotatedTx * aScale + aTx + pivotOffset.x;
          combinedTy = rotatedTy * aScale + aTy + pivotOffset.y;
          combinedRot += aRot;
          combinedScale *= aScale;
          combinedOpacity *= aOpacity;
        }

        // Apply path's own animation
        const own = partTracks[partIdx];
        const pathTx = valueAt(own?.tx, "tx", t);
        const pathTy = valueAt(own?.ty, "ty", t);
        const pathRot = valueAt(own?.rot, "rot", t);
        const pathScale = valueAt(own?.scale, "scale", t);
        // For opacity:
        // - If path has opacity keyframes, use animated value (first keyframe as initial)
        // - If no keyframes but ancestor has opacity keyframes, use 1 (fully controlled by ancestor)
        // - If no one in the chain has opacity keyframes, use base path opacity
        const pathOpacity = own?.opacity
          ? valueAt(own.opacity, "opacity", t)
          : (anyAncestorHasOpacityKeyframes ? 1 : path.opacity);

        const pathPivotOffset = getPivotOffset(
          pivots[partIdx],
          pathRot,
          pathScale,
        );

        const cos = Math.cos(combinedRot);
        const sin = Math.sin(combinedRot);
        const rotatedPathTx = (pathTx + pathPivotOffset.x) * cos -
          (pathTy + pathPivotOffset.y) * sin;
        const rotatedPathTy = (pathTx + pathPivotOffset.x) * sin +
          (pathTy + pathPivotOffset.y) * cos;

        const finalTx = (combinedTx + rotatedPathTx * combinedScale) * scale +
          xOffset;
        const finalTy = (combinedTy + rotatedPathTy * combinedScale) * scale +
          yOffset;
        const finalRot = combinedRot + pathRot;
        const finalScale = combinedScale * pathScale;
        const finalOpacity = combinedOpacity * pathOpacity;

        const dataIdx = clipOffset + partIdx * sampleCount + sampleIdx;
        transformData[dataIdx * 4 + 0] = finalTx;
        transformData[dataIdx * 4 + 1] = finalTy;
        transformData[dataIdx * 4 + 2] = finalRot;
        transformData[dataIdx * 4 + 3] = finalScale;
        opacityData[dataIdx] = finalOpacity;
      }
    }
  }

  const transformTexture = new DataTexture(
    transformData,
    sampleCount,
    partCount * clipCount,
    RGBAFormat,
    FloatType,
  );
  transformTexture.minFilter = LinearFilter;
  transformTexture.magFilter = LinearFilter;
  transformTexture.needsUpdate = true;

  const opacityTexture = new DataTexture(
    opacityData,
    sampleCount,
    partCount * clipCount,
    RedFormat,
    FloatType,
  );
  opacityTexture.minFilter = LinearFilter;
  opacityTexture.magFilter = LinearFilter;
  opacityTexture.needsUpdate = true;

  const clipsMap = new Map<string, { index: number; duration: number }>();
  // Default clip at index 0
  clipsMap.set("default", { index: 0, duration: 0 });
  // Other clips offset by 1
  clips.forEach((c, i) =>
    clipsMap.set(c.name, { index: i + 1, duration: c.duration })
  );

  return {
    partCount,
    sampleCount,
    clipCount,
    fps,
    clips: clipsMap,
    transformTexture,
    opacityTexture,
  };
};
