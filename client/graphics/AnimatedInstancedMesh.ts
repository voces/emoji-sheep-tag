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
  Mesh,
  Object3D,
  Ray,
  Raycaster,
  Sphere,
} from "three";
import { normalizeAngle } from "@/shared/pathing/math.ts";
import { BVH } from "./BVH.ts";
import { editorVar } from "@/vars/editor.ts";
import { getMapBounds } from "@/shared/map.ts";
import type { AnimationData } from "./loadEstb.ts";
import { getDepthMaterial, getShaderRef } from "./AnimatedMeshMaterial.ts";

const dummy = new Object3D();
const _tempBox = new Box3();
const _instanceLocalMatrix = new Matrix4();
const _box3 = new Box3();
const _sphere = new Sphere();

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
  /** Depth pre-pass mesh for intra-instance occlusion */
  readonly depthMesh: InstancedMesh;

  constructor(
    geometry: BufferGeometry,
    material: Material,
    count: number = 1,
    readonly modelName?: string,
    animationData?: AnimationData,
    options?: {
      skipBoundsRecalc?: boolean;
      mapUtilizationThreshold?: number;
    },
  ) {
    super(geometry, material, count);

    this.animationData = animationData ?? null;
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

    const depthMaterial = getDepthMaterial();
    this.depthMesh = new InstancedMesh(geometry, depthMaterial, count);
    this.depthMesh.instanceMatrix = this.instanceMatrix;
    this.depthMesh.renderOrder = 0;
    this.depthMesh.frustumCulled = false;
    this.depthMesh.visible = false; // Only visible when transparent instances exist

    this.depthMesh.onBeforeRender = (
      _renderer,
      _scene,
      _camera,
      _geometry,
      mat,
    ) => {
      const shaderRef = getShaderRef(mat);
      if (!shaderRef) return;
      this.updateAnimationUniforms(shaderRef);
    };

    this.onBeforeRender = (_renderer, _scene, _camera, _geometry, material) => {
      const shaderRef = getShaderRef(material);
      if (!shaderRef) return;
      this.updateAnimationUniforms(shaderRef);
    };

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

    // instanceAnim: [clipIndex, phase, speed] - phase is 0-1 offset, speed is multiplier
    const instanceAnimAttr = new InstancedBufferAttribute(
      new Float32Array(count * 3),
      3,
    );
    // Default: clip 0 ("default" = T-pose), phase 0, speed 0 (frozen)
    for (let i = 0; i < count; i++) {
      instanceAnimAttr.array[i * 3] = 0; // clip 0 = "default" (T-pose)
      instanceAnimAttr.array[i * 3 + 1] = 0; // phase
      instanceAnimAttr.array[i * 3 + 2] = 0; // speed (frozen)
    }
    instanceAnimAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute("instanceAnim", instanceAnimAttr);
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

    // Resize instanceAnim (default: clip 0 = T-pose, phase 0, speed 0)
    const oldAnimAttr = geo.getAttribute("instanceAnim");
    const newAnimAttr = new InstancedBufferAttribute(
      new Float32Array(value * 3),
      3,
    );
    for (let i = 0; i < value; i++) {
      newAnimAttr.array[i * 3] = 0;
      newAnimAttr.array[i * 3 + 1] = 0;
      newAnimAttr.array[i * 3 + 2] = 0;
    }
    if (oldAnimAttr) {
      (newAnimAttr.array as Float32Array).set(
        (oldAnimAttr.array as Float32Array).slice(
          0,
          Math.min(value, this.innerCount) * 3,
        ),
      );
    }
    newAnimAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute("instanceAnim", newAnimAttr);

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
      copyAttr("instanceAnim", 3);

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
    setAttrDefault("instanceAnim", [0, 0, 0]); // clip 0 = "default" (T-pose), phase 0, speed 0

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
   */
  setAnimationAt(
    index: number | string,
    clip: number | string,
    phase: number = 0,
    speed: number = 1,
  ) {
    if (typeof index === "string") index = this.getIndex(index);

    const clipIndex = typeof clip === "string"
      ? this.animationData?.clips.get(clip)?.index ?? 0
      : clip;

    const animAttr = this.geometry.getAttribute("instanceAnim");
    animAttr.setXYZ(index, clipIndex, phase, speed);
    animAttr.needsUpdate = true;
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
    const ray = new Ray().copy(raycaster.ray);
    const candidates = this.bvh.raycast(ray);

    for (const candidate of candidates) {
      const instanceMatrix = new Matrix4();
      this.getMatrixAt(candidate, instanceMatrix);

      const invMat = new Matrix4().copy(instanceMatrix).invert();
      const localRay = new Ray().copy(ray).applyMatrix4(invMat);

      const testMesh = new Mesh(this.geometry, this.material as Material);
      const localIntersects: Intersection[] = [];
      testMesh.raycast(
        { ...raycaster, ray: localRay } as Raycaster,
        localIntersects,
      );

      if (localIntersects.length > 0) {
        for (const hit of localIntersects) {
          hit.point.applyMatrix4(instanceMatrix);
          hit.object = this;
          hit.instanceId = candidate;
          intersects.push(hit);
        }
      }
    }

    return false;
  }
}
