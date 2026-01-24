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

const float16ToFloat = (h: number): number => {
  const sign = (h >> 15) & 0x1;
  const exp = (h >> 10) & 0x1f;
  const frac = h & 0x3ff;

  if (exp === 0) {
    if (frac === 0) return sign ? -0 : 0;
    let e = -14;
    let m = frac;
    while ((m & 0x400) === 0) {
      m <<= 1;
      e--;
    }
    m &= 0x3ff;
    const floatView = new Float32Array(1);
    const int32View = new Int32Array(floatView.buffer);
    int32View[0] = (sign << 31) | ((e + 127) << 23) | (m << 13);
    return floatView[0];
  }

  if (exp === 31) return frac ? NaN : (sign ? -Infinity : Infinity);

  const floatView = new Float32Array(1);
  const int32View = new Int32Array(floatView.buffer);
  int32View[0] = (sign << 31) | ((exp - 15 + 127) << 23) | (frac << 13);
  return floatView[0];
};

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

const getPropertyValue = (
  keyframes: ParsedKeyframe[] | undefined,
  property: "tx" | "ty" | "rot" | "scale" | "opacity",
  t: number,
): number => {
  if (!keyframes || keyframes.length === 0) {
    return defaultPropertyValues[property];
  }

  const relevantKeyframes = keyframes.filter((kf) =>
    kf[property] !== undefined
  );
  if (relevantKeyframes.length === 0) return defaultPropertyValues[property];
  if (relevantKeyframes.length === 1) return relevantKeyframes[0][property]!;

  let left = relevantKeyframes[0];
  let right = relevantKeyframes[relevantKeyframes.length - 1];

  for (let i = 0; i < relevantKeyframes.length - 1; i++) {
    if (relevantKeyframes[i].t <= t && relevantKeyframes[i + 1].t >= t) {
      left = relevantKeyframes[i];
      right = relevantKeyframes[i + 1];
      break;
    }
  }

  if (t <= left.t) return left[property]!;
  if (t >= right.t) return right[property]!;

  const dt = right.t - left.t;
  if (dt === 0) return left[property]!;
  const alpha = (t - left.t) / dt;
  return left[property]! + (right[property]! - left[property]!) * alpha;
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

type ParsedEstb = {
  paths: ParsedPath[];
  groups: ParsedGroup[];
  clips: ParsedClip[];
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
  if (version !== 3) throw new Error(`Unsupported estb version: ${version}`);

  // Read counts
  const pathCount = r.readU16();
  const groupCount = r.readU16();
  const clipCount = r.readU16();

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

  const result = { paths, groups, clips };
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
  const { paths, groups, clips } = parseEstb(buffer);
  const scale = options?.scale ?? 1;
  const xOffset = options?.xOffset ?? 0;
  const yOffset = options?.yOffset ?? 0;

  // Build geometry
  const geometry = buildGeometry(paths, scale, xOffset, yOffset);

  // Build animation data
  const animationData = buildAnimationData(paths, groups, clips, scale);

  return {
    geometry,
    animationData,
    parts: paths.map((_, i) => ({ index: i })),
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

      for (const seg of path.segments) {
        shape.bezierCurveTo(
          seg.c0.x * scale,
          seg.c0.y * scale,
          seg.c1.x * scale,
          seg.c1.y * scale,
          seg.p1.x * scale,
          seg.p1.y * scale,
        );
      }
      shape.closePath();
    }

    const shapeGeo = hasVertexColors
      ? new ShapeGeometry(shape)
      : new ShapeGeometry(shape, 32);

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
    "partID",
    new BufferAttribute(new Float32Array(allPartIDs), 1),
  );
  geometry.setAttribute(
    "playerMask",
    new BufferAttribute(new Float32Array(allPlayerMasks), 1),
  );

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
};

const buildAnimationData = (
  paths: ParsedPath[],
  groups: ParsedGroup[],
  clips: ParsedClip[],
  scale: number,
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

  const getAncestorChain = (path: ParsedPath): ParsedGroup[] => {
    const chain: ParsedGroup[] = [];
    let parentIdx = path.parentIdx;
    while (parentIdx !== null && parentIdx < groups.length) {
      const parent = groups[parentIdx];
      chain.unshift(parent);
      parentIdx = parent.parentIdx;
    }
    return chain;
  };

  const getPathTransformPoint = (path: ParsedPath): Point => {
    if (path.transformPoint) return path.transformPoint;
    let sumX = 0, sumY = 0, count = 0;
    for (const seg of path.segments) {
      sumX += seg.p0.x;
      sumY += seg.p0.y;
      count++;
    }
    return count > 0 ? { x: sumX / count, y: sumY / count } : { x: 0, y: 0 };
  };

  const totalSamples = sampleCount * partCount * clipCount;
  const transformData = new Float32Array(totalSamples * 4);
  const opacityData = new Float32Array(totalSamples);

  // Clip 0 is the "default" clip with identity transforms but using base path opacity
  for (let sampleIdx = 0; sampleIdx < sampleCount; sampleIdx++) {
    for (let partIdx = 0; partIdx < partCount; partIdx++) {
      const dataIdx = partIdx * sampleCount + sampleIdx;
      transformData[dataIdx * 4 + 0] = 0; // tx
      transformData[dataIdx * 4 + 1] = 0; // ty
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

    for (let sampleIdx = 0; sampleIdx < sampleCount; sampleIdx++) {
      // Shader samples using normalized time t in [0,1], so we bake at normalized time
      // NOT real time. The keyframes are in real seconds, so we scale back.
      const normalizedT = sampleCount > 1 ? sampleIdx / (sampleCount - 1) : 0;
      const t = normalizedT * clip.duration;

      for (let partIdx = 0; partIdx < partCount; partIdx++) {
        const path = paths[partIdx];
        const ancestorChain = getAncestorChain(path);

        let combinedTx = 0,
          combinedTy = 0,
          combinedRot = 0,
          combinedScale = 1,
          combinedOpacity = 1;

        // Track if any ancestor has opacity keyframes
        let anyAncestorHasOpacityKeyframes = false;

        // Apply ancestor transforms
        for (let gi = 0; gi < ancestorChain.length; gi++) {
          const ancestor = ancestorChain[gi];
          // Find the group's index to look up animation
          let groupIdx = -1;
          for (let i = 0; i < groups.length; i++) {
            if (groups[i] === ancestor) {
              groupIdx = i;
              break;
            }
          }
          if (groupIdx < 0) continue;

          const ancestorAnim = clip.parts.get(-(groupIdx + 1));
          if (ancestorAnim && ancestorAnim.length > 0) {
            const aTx = getPropertyValue(ancestorAnim, "tx", t);
            const aTy = getPropertyValue(ancestorAnim, "ty", t);
            const aRot = getPropertyValue(ancestorAnim, "rot", t);
            const aScale = getPropertyValue(ancestorAnim, "scale", t);
            // For opacity: use animated value if keyframes exist, otherwise treat as 1
            // (parent opacity controls children, but only if explicitly animated)
            const hasAncestorOpacityKeyframes = ancestorAnim.some((kf) =>
              kf.opacity !== undefined
            );
            if (hasAncestorOpacityKeyframes) {
              anyAncestorHasOpacityKeyframes = true;
            }
            const aOpacity = hasAncestorOpacityKeyframes
              ? getPropertyValue(ancestorAnim, "opacity", t)
              : 1;

            const pivot = ancestor.transformPoint ?? { x: 0, y: 0 };
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
        }

        // Apply path's own animation
        const partAnim = clip.parts.get(partIdx);
        const pathTx = getPropertyValue(partAnim, "tx", t);
        const pathTy = getPropertyValue(partAnim, "ty", t);
        const pathRot = getPropertyValue(partAnim, "rot", t);
        const pathScale = getPropertyValue(partAnim, "scale", t);
        // For opacity:
        // - If path has opacity keyframes, use animated value (first keyframe as initial)
        // - If no keyframes but ancestor has opacity keyframes, use 1 (fully controlled by ancestor)
        // - If no one in the chain has opacity keyframes, use base path opacity
        const hasOpacityKeyframes = partAnim?.some((kf) =>
          kf.opacity !== undefined
        ) ?? false;
        const pathOpacity = hasOpacityKeyframes
          ? getPropertyValue(partAnim, "opacity", t)
          : (anyAncestorHasOpacityKeyframes ? 1 : path.opacity);

        const pathPivot = getPathTransformPoint(path);
        const pathPivotOffset = getPivotOffset(pathPivot, pathRot, pathScale);

        const cos = Math.cos(combinedRot);
        const sin = Math.sin(combinedRot);
        const rotatedPathTx = (pathTx + pathPivotOffset.x) * cos -
          (pathTy + pathPivotOffset.y) * sin;
        const rotatedPathTy = (pathTx + pathPivotOffset.x) * sin +
          (pathTy + pathPivotOffset.y) * cos;

        const finalTx = (combinedTx + rotatedPathTx * combinedScale) * scale;
        const finalTy = (combinedTy + rotatedPathTy * combinedScale) * scale;
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
