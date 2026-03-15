/**
 * AnimatedInstancedMesh - Instanced mesh with GPU-driven part-based animation.
 *
 * Animation is entirely GPU-side:
 * - Each vertex has a partID attribute
 * - Per-instance: animClip, animPhase, animSpeed
 * - Shader samples transform/opacity textures based on uTime
 */

import {
  Box3,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Intersection,
  Material,
  Matrix4,
  Object3D,
  Ray,
  Raycaster,
  Sphere,
  Vector3,
} from "three";
import { normalizeAngle } from "@/shared/pathing/math.ts";
import { BVH } from "./BVH.ts";
import { editorVar } from "@/vars/editor.ts";
import { getMapBounds } from "@/shared/map.ts";
import type { AnimationData, ParsedCamera } from "./loadEstb.ts";
import {
  createDepthMaterial,
  getShaderRefs,
  onShaderReady,
} from "./AnimatedMeshMaterial.ts";

const dummy = new Object3D();
const _tempBox = new Box3();
const _instanceLocalMatrix = new Matrix4();
const _box3 = new Box3();
const _sphere = new Sphere();
const _raycastRay = new Ray();

export class AnimatedInstancedMesh extends InstancedMesh {
  private map: Record<string, number> = {};
  private reverseMap: string[] = [];
  private innerCount: number;
  private bvh: BVH;
  private skipBoundsRecalc: boolean;
  private mapUtilizationThreshold: number;
  private debouncingBoundingBox = false;
  private debouncingBoundingSphere = false;
  private transparentInstanceCount = 0;

  /** Animation data (textures, clip info) */
  readonly animationData: AnimationData | null;
  /** Camera definitions from the estb file */
  readonly cameras: ParsedCamera[];
  /** Scale factor used when building geometry */
  readonly modelScale: number;
  /** Depth pre-pass mesh for intra-instance occlusion */
  readonly depthMesh: InstancedMesh;
  /** Callback when shader is ready (for re-applying animations) */
  onShaderReady?: () => void;

  constructor(
    geometry: BufferGeometry,
    material: Material,
    count: number = 1,
    readonly modelName: string,
    animationData?: AnimationData,
    options?: {
      cameras?: ParsedCamera[];
      modelScale?: number;
      skipBoundsRecalc?: boolean;
      mapUtilizationThreshold?: number;
    },
  ) {
    super(geometry, material, count);

    this.animationData = animationData ?? null;
    this.cameras = options?.cameras ?? [];
    this.modelScale = options?.modelScale ?? 1;
    this.bvh = new BVH(modelName);
    this.bvh.setGetBoundingBox((index) => {
      this.getMatrixAt(index, _instanceLocalMatrix);
      return this.isFiniteMatrix(_instanceLocalMatrix)
        ? this.computeInstanceBoundingBox(index)
        : null;
    });
    this.innerCount = count;
    this.skipBoundsRecalc = options?.skipBoundsRecalc ?? false;
    this.mapUtilizationThreshold = options?.mapUtilizationThreshold ?? 0.5;

    this.initializeInstanceAttributes(count);
    this.patchBounds();

    const depthMaterial = createDepthMaterial();
    this.depthMesh = new InstancedMesh(geometry, depthMaterial, count);
    this.depthMesh.instanceMatrix = this.instanceMatrix;
    this.depthMesh.renderOrder = 0;
    this.depthMesh.frustumCulled = false;
    this.depthMesh.visible = false; // Only visible when transparent instances exist

    this.depthMesh.onBeforeRender = (_r, _s, _c, _g, mat) => {
      for (const shaderRef of getShaderRefs(mat)) {
        this.updateAnimationUniforms(shaderRef);
      }
    };

    this.onBeforeRender = (_r, _s, _c, _g, mat) => {
      for (const shaderRef of getShaderRefs(mat)) {
        this.updateAnimationUniforms(shaderRef);
      }
    };

    onShaderReady(material, () => {
      if (this.onShaderReady) this.onShaderReady();
    });

    for (let i = 0; i < count; i++) {
      this.setPositionAt(i, Infinity, Infinity, undefined, Infinity);
    }
  }

  private updateAnimationUniforms(
    shaderRef: { uniforms: Record<string, { value: unknown }> },
  ) {
    if (this.animationData) {
      shaderRef.uniforms.uTransformTex.value =
        this.animationData.transformTexture;
      shaderRef.uniforms.uOpacityTex.value = this.animationData.opacityTexture;
      shaderRef.uniforms.uSampleCount.value = this.animationData.sampleCount;
      shaderRef.uniforms.uPartCount.value = this.animationData.partCount;
      shaderRef.uniforms.uClipCount.value = this.animationData.clipCount;
    } else {
      shaderRef.uniforms.uTransformTex.value = null;
      shaderRef.uniforms.uOpacityTex.value = null;
      shaderRef.uniforms.uSampleCount.value = 1;
      shaderRef.uniforms.uPartCount.value = 0;
      shaderRef.uniforms.uClipCount.value = 1;
    }
  }

  private initializeInstanceAttributes(count: number) {
    const geo = this.geometry;

    const instanceAlphaAttr = new InstancedBufferAttribute(
      new Float32Array(count),
      1,
    );
    instanceAlphaAttr.array.fill(1);
    instanceAlphaAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute("instanceAlpha", instanceAlphaAttr);

    const instanceMinimapMaskAttr = new InstancedBufferAttribute(
      new Float32Array(count),
      1,
    );
    instanceMinimapMaskAttr.array.fill(0);
    instanceMinimapMaskAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute("instanceMinimapMask", instanceMinimapMaskAttr);

    const instancePlayerColorAttr = new InstancedBufferAttribute(
      new Float32Array(count * 3),
      3,
    );
    for (let i = 0; i < count * 3; i++) instancePlayerColorAttr.array[i] = 1;
    instancePlayerColorAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute("instancePlayerColor", instancePlayerColorAttr);

    // instanceTint: [R, G, B] - multiplied with vertex color for non-player vertices
    const instanceTintAttr = new InstancedBufferAttribute(
      new Float32Array(count * 3),
      3,
    );
    for (let i = 0; i < count * 3; i++) instanceTintAttr.array[i] = 1;
    instanceTintAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute("instanceTint", instanceTintAttr);

    // instanceAnim: [clipIndex, phase, speed, decayRate]
    const instanceAnimAttr = new InstancedBufferAttribute(
      new Float32Array(count * 4),
      4,
    );
    for (let i = 0; i < count; i++) {
      instanceAnimAttr.array[i * 4 + 3] = 1 / 0.15; // default decay rate
    }
    instanceAnimAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute("instanceAnim", instanceAnimAttr);

    // instanceAnimB: [clipIndex, phase, speed, weight] - blend target
    const instanceAnimBAttr = new InstancedBufferAttribute(
      new Float32Array(count * 4),
      4,
    );
    instanceAnimBAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute("instanceAnimB", instanceAnimBAttr);
  }

  resize(value: number) {
    const geo = this.geometry;

    const oldMatrixArray = this.instanceMatrix.array;
    const newMatrixArray = new Float32Array(value * 16);
    newMatrixArray.set(
      oldMatrixArray.slice(0, Math.min(value, this.innerCount) * 16),
    );
    dummy.matrix.setPosition(Infinity, Infinity, Infinity);
    for (let n = this.innerCount; n < value; n++) {
      dummy.matrix.toArray(newMatrixArray, n * 16);
    }
    this.instanceMatrix = new InstancedBufferAttribute(newMatrixArray, 16);
    this.instanceMatrix.setUsage(DynamicDrawUsage);

    const resizeFloatAttr = (
      name: string,
      components: number,
      defaultValue: number,
    ) => {
      const oldAttr = geo.getAttribute(name);
      const newAttr = new InstancedBufferAttribute(
        new Float32Array(value * components),
        components,
      );
      newAttr.array.fill(defaultValue);
      if (oldAttr) {
        (newAttr.array as Float32Array).set(
          (oldAttr.array as Float32Array).slice(
            0,
            Math.min(value, this.innerCount) * components,
          ),
        );
      }
      newAttr.setUsage(DynamicDrawUsage);
      geo.setAttribute(name, newAttr);
    };

    resizeFloatAttr("instanceAlpha", 1, 1);
    resizeFloatAttr("instanceMinimapMask", 1, 0);

    // Resize instancePlayerColor (default to white)
    const oldPlayerColorAttr = geo.getAttribute("instancePlayerColor");
    const newPlayerColorAttr = new InstancedBufferAttribute(
      new Float32Array(value * 3),
      3,
    );
    for (let i = 0; i < value * 3; i++) newPlayerColorAttr.array[i] = 1;
    if (oldPlayerColorAttr) {
      (newPlayerColorAttr.array as Float32Array).set(
        (oldPlayerColorAttr.array as Float32Array).slice(
          0,
          Math.min(value, this.innerCount) * 3,
        ),
      );
    }
    newPlayerColorAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute("instancePlayerColor", newPlayerColorAttr);

    // Resize instanceTint (default to white)
    const oldTintAttr = geo.getAttribute("instanceTint");
    const newTintAttr = new InstancedBufferAttribute(
      new Float32Array(value * 3),
      3,
    );
    for (let i = 0; i < value * 3; i++) newTintAttr.array[i] = 1;
    if (oldTintAttr) {
      (newTintAttr.array as Float32Array).set(
        (oldTintAttr.array as Float32Array).slice(
          0,
          Math.min(value, this.innerCount) * 3,
        ),
      );
    }
    newTintAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute("instanceTint", newTintAttr);

    // Resize instanceAnim (default: clip 0, phase 0, speed 0, decayRate)
    const oldAnimAttr = geo.getAttribute("instanceAnim");
    const newAnimAttr = new InstancedBufferAttribute(
      new Float32Array(value * 4),
      4,
    );
    for (let i = 0; i < value; i++) {
      newAnimAttr.array[i * 4 + 3] = 1 / 0.15;
    }
    if (oldAnimAttr) {
      const oldComponents = oldAnimAttr.itemSize;
      const copyCount = Math.min(value, this.innerCount);
      for (let i = 0; i < copyCount; i++) {
        for (let c = 0; c < Math.min(oldComponents, 4); c++) {
          newAnimAttr.array[i * 4 + c] =
            (oldAnimAttr.array as Float32Array)[i * oldComponents + c];
        }
      }
    }
    newAnimAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute("instanceAnim", newAnimAttr);

    // Resize instanceAnimB (default: all zeros)
    const oldAnimBAttr = geo.getAttribute("instanceAnimB");
    const newAnimBAttr = new InstancedBufferAttribute(
      new Float32Array(value * 4),
      4,
    );
    if (oldAnimBAttr) {
      (newAnimBAttr.array as Float32Array).set(
        (oldAnimBAttr.array as Float32Array).slice(
          0,
          Math.min(value, this.innerCount) * 4,
        ),
      );
    }
    newAnimBAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute("instanceAnimB", newAnimBAttr);

    // Update map for removed instances
    for (let i = this.innerCount; i > value; i--) {
      const id = this.reverseMap[i];
      delete this.map[id];
    }
    if (this.innerCount > value) this.reverseMap.splice(value);

    this.innerCount = value;
    // deno-lint-ignore no-explicit-any
    (this as any).count = value;

    this.depthMesh.instanceMatrix = this.instanceMatrix;
    // deno-lint-ignore no-explicit-any
    (this.depthMesh as any).count = value;
  }

  getCount() {
    return this.innerCount;
  }

  delete(id: string) {
    if (!(id in this.map)) return;
    const index = this.map[id];
    const swapIndex = this.reverseMap.length - 1;

    // Update transparent count if deleted instance was transparent
    const instanceAlphaAttr = this.geometry.getAttribute("instanceAlpha");
    if (instanceAlphaAttr.getX(index) < 1) {
      this.transparentInstanceCount--;
      this.depthMesh.visible = this.transparentInstanceCount > 0;
    }

    if (swapIndex !== index) {
      const swapId = this.reverseMap[swapIndex];

      this.getMatrixAt(swapIndex, dummy.matrix);
      this.setMatrixAtIndex(index, dummy.matrix);

      this.setPositionAt(swapId, Infinity, Infinity, undefined, Infinity);

      const copyAttr = (name: string, components: number) => {
        const attr = this.geometry.getAttribute(name);
        if (!attr) return;
        for (let c = 0; c < components; c++) {
          const value =
            (attr.array as Float32Array)[swapIndex * components + c];
          (attr.array as Float32Array)[index * components + c] = value;
        }
        attr.needsUpdate = true;
      };

      copyAttr("instanceAlpha", 1);
      copyAttr("instanceMinimapMask", 1);
      copyAttr("instancePlayerColor", 3);
      copyAttr("instanceTint", 3);
      copyAttr("instanceAnim", 4);
      copyAttr("instanceAnimB", 4);

      this.map[swapId] = index;
      this.reverseMap[index] = swapId;
    } else {
      dummy.matrix.setPosition(Infinity, Infinity, Infinity);
      this.setMatrixAtIndex(index, dummy.matrix);
    }

    delete this.map[id];
    this.reverseMap.pop();
  }

  private getIndex(id: string) {
    if (id in this.map) return this.map[id];
    const index = this.reverseMap.push(id) - 1;
    this.map[id] = index;
    if (index + 1 > this.getCount()) this.resize((index + 1) * 2);

    dummy.matrix.identity();
    this.setMatrixAtIndex(index, dummy.matrix);

    const setAttrDefault = (name: string, values: number[]) => {
      const attr = this.geometry.getAttribute(name);
      if (!attr) return;
      for (let c = 0; c < values.length; c++) {
        (attr.array as Float32Array)[index * values.length + c] = values[c];
      }
      attr.needsUpdate = true;
    };

    setAttrDefault("instanceAlpha", [1]);
    setAttrDefault("instanceMinimapMask", [0]);
    setAttrDefault("instancePlayerColor", [1, 1, 1]);
    setAttrDefault("instanceTint", [1, 1, 1]);
    setAttrDefault("instanceAnim", [0, 0, 0, 1 / 0.15]);
    setAttrDefault("instanceAnimB", [0, 0, 0, 0]);

    return index;
  }

  getId(index: number): string | undefined {
    return this.reverseMap[index];
  }

  private setMatrixAtIndex(index: number, matrix: Matrix4) {
    this.setMatrixAt(index, matrix);
    this.instanceMatrix.needsUpdate = true;
    this.updateBvhInstance(index, matrix);
  }

  private updateBvhInstance(index: number, matrix: Matrix4) {
    // Skip BVH updates for layer 2 (doodads)
    if (this.layers.mask & 4 && !editorVar()) return;

    if (!this.isFiniteMatrix(matrix)) {
      this.bvh.queueUpdate(index, null);
    } else {
      const bbox = this.computeInstanceBoundingBox(index);
      this.bvh.queueUpdate(index, bbox);
    }
  }

  private patchBounds() {
    // deno-lint-ignore no-this-alias
    const self = this;

    this.computeBoundingBox = function () {
      const geometry = this.geometry;

      if (this.boundingBox === null) this.boundingBox = new Box3();
      if (geometry.boundingBox === null) geometry.computeBoundingBox();

      this.boundingBox.makeEmpty();

      for (let i = 0; i < self.innerCount; i++) {
        this.getMatrixAt(i, _instanceLocalMatrix);
        if (self.isFiniteMatrix(_instanceLocalMatrix)) {
          _box3.copy(geometry.boundingBox!).applyMatrix4(_instanceLocalMatrix);
          this.boundingBox.union(_box3);
        }
      }
    };

    this.computeBoundingSphere = function () {
      const geometry = this.geometry;

      if (this.boundingSphere === null) this.boundingSphere = new Sphere();
      if (geometry.boundingSphere === null) geometry.computeBoundingSphere();

      this.boundingSphere.makeEmpty();

      for (let i = 0; i < self.innerCount; i++) {
        this.getMatrixAt(i, _instanceLocalMatrix);
        if (self.isFiniteMatrix(_instanceLocalMatrix)) {
          _sphere.copy(geometry.boundingSphere!).applyMatrix4(
            _instanceLocalMatrix,
          );
          this.boundingSphere.union(_sphere);
        }
      }
    };
  }

  private shouldSkipBoundsRecalc(): boolean {
    if (this.skipBoundsRecalc) return true;

    if (!this.boundingBox) this.computeBoundingBox();
    if (!this.boundingBox || this.boundingBox.isEmpty()) return false;

    const bbox = this.boundingBox;
    const bboxWidth = bbox.max.x - bbox.min.x;
    const bboxHeight = bbox.max.y - bbox.min.y;
    const bboxArea = bboxWidth * bboxHeight;

    const bounds = getMapBounds();
    const mapWidth = bounds.max.x - bounds.min.x;
    const mapHeight = bounds.max.y - bounds.min.y;
    const mapArea = mapWidth * mapHeight;

    return bboxArea / mapArea > this.mapUtilizationThreshold;
  }

  private debouncedComputeBoundingBox() {
    if (this.shouldSkipBoundsRecalc()) return;
    if (this.debouncingBoundingBox) return;
    this.debouncingBoundingBox = true;
    queueMicrotask(() => {
      this.debouncingBoundingBox = false;
      this.computeBoundingBox();
    });
  }

  private debouncedComputeBoundingSphere() {
    if (this.shouldSkipBoundsRecalc()) return;
    if (this.debouncingBoundingSphere) return;
    this.debouncingBoundingSphere = true;
    queueMicrotask(() => {
      this.debouncingBoundingSphere = false;
      this.computeBoundingSphere();
    });
  }

  setPositionAt(
    index: number | string,
    x: number,
    y: number,
    angle?: number | null,
    z?: number,
  ) {
    if (typeof index === "string") index = this.getIndex(index);

    this.getMatrixAt(index, dummy.matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

    if (typeof angle === "number") {
      const norm = normalizeAngle(angle);
      const flip = norm < (Math.PI / 2) && norm > (Math.PI / -2);
      dummy.rotation.z = flip ? Math.PI - norm : norm + Math.PI;
      dummy.rotation.x = flip ? Math.PI : 0;
    } else {
      dummy.rotation.z = 0;
      dummy.rotation.x = 0;
    }
    dummy.position.set(
      x,
      y,
      z ?? (Number.isFinite(dummy.position.z) ? dummy.position.z : 0),
    );
    dummy.updateMatrix();

    this.setMatrixAt(index, dummy.matrix);
    this.instanceMatrix.needsUpdate = true;
    this.debouncedComputeBoundingBox();
    this.debouncedComputeBoundingSphere();
    this.updateBvhInstance(index, dummy.matrix);
  }

  getPositionAt(index: number | string) {
    if (typeof index === "string") index = this.getIndex(index);
    this.getMatrixAt(index, dummy.matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
    return dummy.position.clone();
  }

  setPlayerColorAt(index: number | string, color: Color) {
    if (typeof index === "string") index = this.getIndex(index);
    const playerColorAttr = this.geometry.getAttribute("instancePlayerColor");
    playerColorAttr.setXYZ(index, color.r, color.g, color.b);
    playerColorAttr.needsUpdate = true;
  }

  setVertexColorAt(index: number | string, color: Color) {
    if (typeof index === "string") index = this.getIndex(index);
    this.setTintAt(index, color);
  }

  setAlphaAt(index: number | string, alpha: number) {
    if (typeof index === "string") index = this.getIndex(index);
    const instanceAlphaAttr = this.geometry.getAttribute("instanceAlpha");
    const prevAlpha = instanceAlphaAttr.getX(index);

    // Track transparent instance count for depth mesh visibility optimization
    const wasTransparent = prevAlpha < 1;
    const isTransparent = alpha < 1;
    if (wasTransparent && !isTransparent) {
      this.transparentInstanceCount--;
    } else if (!wasTransparent && isTransparent) {
      this.transparentInstanceCount++;
    }
    this.depthMesh.visible = this.transparentInstanceCount > 0;

    instanceAlphaAttr.setX(index, alpha);
    instanceAlphaAttr.needsUpdate = true;
  }

  setMinimapMaskAt(index: number | string, maskValue: number) {
    if (typeof index === "string") index = this.getIndex(index);
    const instanceMinimapMaskAttr = this.geometry.getAttribute(
      "instanceMinimapMask",
    );
    instanceMinimapMaskAttr.setX(index, maskValue);
    instanceMinimapMaskAttr.needsUpdate = true;
  }

  /**
   * Set tint color for an instance.
   * Tint is multiplied with the base vertex color for non-player vertices.
   */
  setTintAt(index: number | string, color: Color) {
    if (typeof index === "string") index = this.getIndex(index);
    const tintAttr = this.geometry.getAttribute("instanceTint");
    tintAttr.setXYZ(index, color.r, color.g, color.b);
    tintAttr.needsUpdate = true;
  }

  /** Clear tint for an instance (reset to white/no tint). */
  clearTintAt(index: number | string) {
    if (typeof index === "string") index = this.getIndex(index);
    const tintAttr = this.geometry.getAttribute("instanceTint");
    tintAttr.setXYZ(index, 1, 1, 1);
    tintAttr.needsUpdate = true;
  }

  /**
   * Set animation state for an instance.
   * @param clip Animation clip index or name
   * @param phase Phase offset (0-1, added to time for desync)
   * @param speed Playback speed multiplier
   * @param crossfade Whether to crossfade from the previous animation
   */
  setAnimationAt(
    index: number | string,
    clip: number | string,
    phase: number = 0,
    speed: number = 1,
    crossfade: boolean = false,
  ) {
    if (typeof index === "string") index = this.getIndex(index);

    const clipIndex = typeof clip === "string"
      ? this.animationData?.clips.get(clip)?.index ?? 0
      : clip;

    const animAttr = this.geometry.getAttribute("instanceAnim");
    const animBAttr = this.geometry.getAttribute("instanceAnimB");

    if (crossfade) {
      const arr = animAttr.array as Float32Array;
      const prevClip = arr[index * 4];
      const prevPhase = arr[index * 4 + 1];
      const prevSpeed = arr[index * 4 + 2];
      animBAttr.setXYZW(index, prevClip, prevPhase, prevSpeed, 1);
    } else {
      animBAttr.setXYZW(index, 0, 0, 0, 0);
    }
    animBAttr.needsUpdate = true;

    const newClipInfo = typeof clip === "string"
      ? this.animationData?.clips.get(clip)
      : undefined;
    const crossfadeDuration = Math.min(
      0.15,
      (newClipInfo?.duration ?? 1) * 0.3,
    );

    animAttr.setXYZW(index, clipIndex, phase, speed, 1 / crossfadeDuration);
    animAttr.needsUpdate = true;
  }

  /** Decay all blend weights toward 0. Returns true if any were non-zero. */
  decayBlendWeights(delta: number, rateScale: number = 1): boolean {
    const animAttr = this.geometry.getAttribute("instanceAnim");
    const animBAttr = this.geometry.getAttribute("instanceAnimB");
    if (!animBAttr || !animAttr) return false;
    const animArr = animAttr.array as Float32Array;
    const blendArr = animBAttr.array as Float32Array;
    let dirty = false;
    for (let i = 0; i < this.innerCount; i++) {
      const w = blendArr[i * 4 + 3];
      if (w > 0) {
        const rate = animArr[i * 4 + 3] * rateScale;
        const next = Math.max(0, w - delta * rate);
        blendArr[i * 4 + 3] = next;
        dirty = true;
      }
    }
    if (dirty) animBAttr.needsUpdate = true;
    return dirty;
  }

  /** Get clip info by name. */
  getClipInfo(name: string): { index: number; duration: number } | undefined {
    return this.animationData?.clips.get(name);
  }

  saveInstanceColors(index: number | string): Color | null {
    if (typeof index === "string") index = this.getIndex(index);
    const tintAttr = this.geometry.getAttribute("instanceTint");
    if (tintAttr) {
      const r = tintAttr.getX(index);
      const g = tintAttr.getY(index);
      const b = tintAttr.getZ(index);
      return new Color(r, g, b);
    }
    return null;
  }

  restoreInstanceColors(index: number | string, color: Color | null) {
    if (typeof index === "string") index = this.getIndex(index);
    if (color) this.setTintAt(index, color);
  }

  setScaleAt(index: number | string, scale: number, aspectRatio?: number) {
    if (typeof index === "string") index = this.getIndex(index);

    this.getMatrixAt(index, dummy.matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
    dummy.scale.setScalar(scale);
    if (typeof aspectRatio === "number") {
      dummy.scale.setY(dummy.scale.y * aspectRatio);
    }
    dummy.updateMatrix();

    this.setMatrixAt(index, dummy.matrix);
    this.instanceMatrix.needsUpdate = true;
    this.debouncedComputeBoundingBox();
    this.debouncedComputeBoundingSphere();
    this.updateBvhInstance(index, dummy.matrix);
  }

  private computeInstanceBoundingBox(index: number): Box3 {
    _tempBox.makeEmpty();

    const geoBox = this.geometry.boundingBox;
    if (!geoBox) this.geometry.computeBoundingBox();

    const matrix = new Matrix4();
    this.getMatrixAt(index, matrix);

    _tempBox.copy(this.geometry.boundingBox!).applyMatrix4(matrix);
    return _tempBox.clone();
  }

  private isFiniteMatrix(m: Matrix4): boolean {
    const e = m.elements;
    return Number.isFinite(e[12]) && Number.isFinite(e[13]) &&
      Number.isFinite(e[14]);
  }

  override raycast(raycaster: Raycaster, intersects: Intersection[]) {
    _raycastRay.copy(raycaster.ray);
    const candidates = this.bvh.raycast(_raycastRay);

    for (const candidate of candidates) {
      intersects.push({
        distance: -this.renderOrder,
        point: new Vector3(),
        object: this,
        instanceId: candidate,
      });
    }

    return false;
  }
}
