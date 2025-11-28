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
import { mergeGeometries } from "three/BufferGeometryUtils";
import { normalizeAngle } from "@/shared/pathing/math.ts";
import { BVH } from "./BVH.ts";
import { editorVar } from "@/vars/editor.ts";
import { getMapBounds } from "@/shared/map.ts";

const dummy = new Object3D();
const dummyColor = new Color();

const _tempBox = new Box3();
const _instanceLocalMatrix = new Matrix4();
const _box3 = new Box3();
const _sphere = new Sphere();

export class InstancedSvg extends InstancedMesh {
  private map: Record<string, number> = {};
  private reverseMap: string[] = [];
  private innerCount: number;
  private bvh: BVH;
  private skipBoundsRecalc: boolean;
  private mapUtilizationThreshold: number;
  private playerVertexMask: Float32Array | null = null;
  shapeCount: number = 1;

  constructor(
    geometries: BufferGeometry[],
    material: Material,
    count: number = 1,
    readonly svgName?: string,
    options?: {
      skipBoundsRecalc?: boolean;
      mapUtilizationThreshold?: number;
    },
  ) {
    // Merge all geometries into one
    const mergedGeometry = mergeGeometries(geometries, false);
    if (!mergedGeometry) {
      throw new Error("Failed to merge geometries");
    }

    super(mergedGeometry, material, count);

    this.bvh = new BVH(svgName);
    this.innerCount = count;
    this.skipBoundsRecalc = options?.skipBoundsRecalc ?? false;
    this.mapUtilizationThreshold = options?.mapUtilizationThreshold ?? 0.5;

    // Build player vertex mask from merged geometry
    this.buildPlayerVertexMask(geometries);

    // Add instance attributes
    const instanceAlphaAttr = new InstancedBufferAttribute(
      new Float32Array(count),
      1,
    );
    instanceAlphaAttr.array.fill(1);
    mergedGeometry.setAttribute("instanceAlpha", instanceAlphaAttr);

    const instanceMinimapMaskAttr = new InstancedBufferAttribute(
      new Float32Array(count),
      1,
    );
    instanceMinimapMaskAttr.array.fill(0);
    mergedGeometry.setAttribute("instanceMinimapMask", instanceMinimapMaskAttr);

    // Player color - only applies to player-masked vertices
    const instancePlayerColorAttr = new InstancedBufferAttribute(
      new Float32Array(count * 3),
      3,
    );
    // Initialize to white
    for (let i = 0; i < count * 3; i++) {
      instancePlayerColorAttr.array[i] = 1;
    }
    instancePlayerColorAttr.setUsage(DynamicDrawUsage);
    mergedGeometry.setAttribute("instancePlayerColor", instancePlayerColorAttr);

    // Patch bounding box/sphere computation
    this.patchBounds();

    // Initialize all instances at infinity
    for (let i = 0; i < count; i++) {
      this.setPositionAt(i, Infinity, Infinity, undefined, Infinity);
    }
  }

  private buildPlayerVertexMask(geometries: BufferGeometry[]) {
    // Calculate total vertex count
    let totalVertices = 0;
    for (const geo of geometries) {
      totalVertices += geo.attributes.position.count;
    }

    this.playerVertexMask = new Float32Array(totalVertices);

    this.shapeCount = geometries.length;

    let offset = 0;
    for (const geo of geometries) {
      const vertexCount = geo.attributes.position.count;
      const isPlayer = geo.userData?.player === true;

      for (let i = 0; i < vertexCount; i++) {
        this.playerVertexMask[offset + i] = isPlayer ? 1 : 0;
      }
      offset += vertexCount;
    }
    // Note: playerMask is encoded in intrinsicOpacity (values > 1.0) for shader access
  }

  resize(value: number) {
    // Recreate instanced mesh with new count
    const geo = this.geometry;

    // Resize instance matrix
    const oldMatrixArray = this.instanceMatrix.array;
    const newMatrixArray = new Float32Array(value * 16);
    newMatrixArray.set(
      oldMatrixArray.slice(0, Math.min(value, this.innerCount) * 16),
    );
    // Initialize new instances at infinity
    dummy.matrix.setPosition(Infinity, Infinity, Infinity);
    for (let n = this.innerCount; n < value; n++) {
      dummy.matrix.toArray(newMatrixArray, n * 16);
    }
    this.instanceMatrix = new InstancedBufferAttribute(newMatrixArray, 16);
    this.instanceMatrix.setUsage(DynamicDrawUsage);

    // Resize instance color if it exists
    if (this.instanceColor) {
      const oldColorArray = this.instanceColor.array;
      const newColorArray = new Float32Array(value * 3);
      newColorArray.set(
        oldColorArray.slice(0, Math.min(value, this.innerCount) * 3),
      );
      // Initialize new slots with white
      for (let i = this.innerCount * 3; i < value * 3; i += 3) {
        newColorArray[i] = 1;
        newColorArray[i + 1] = 1;
        newColorArray[i + 2] = 1;
      }
      this.instanceColor = new InstancedBufferAttribute(newColorArray, 3);
      this.instanceColor.setUsage(DynamicDrawUsage);
    }

    // Resize instanceAlpha
    const oldAlphaAttr = geo.getAttribute("instanceAlpha");
    const newAlphaAttr = new InstancedBufferAttribute(
      new Float32Array(value),
      1,
    );
    newAlphaAttr.array.fill(1);
    if (oldAlphaAttr) {
      (newAlphaAttr.array as Float32Array).set(
        (oldAlphaAttr.array as Float32Array).slice(
          0,
          Math.min(value, this.innerCount),
        ),
      );
    }
    newAlphaAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute("instanceAlpha", newAlphaAttr);

    // Resize instanceMinimapMask
    const oldMaskAttr = geo.getAttribute("instanceMinimapMask");
    const newMaskAttr = new InstancedBufferAttribute(
      new Float32Array(value),
      1,
    );
    newMaskAttr.array.fill(0);
    if (oldMaskAttr) {
      (newMaskAttr.array as Float32Array).set(
        (oldMaskAttr.array as Float32Array).slice(
          0,
          Math.min(value, this.innerCount),
        ),
      );
    }
    newMaskAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute("instanceMinimapMask", newMaskAttr);

    // Resize instancePlayerColor
    const oldPlayerColorAttr = geo.getAttribute("instancePlayerColor");
    const newPlayerColorAttr = new InstancedBufferAttribute(
      new Float32Array(value * 3),
      3,
    );
    // Initialize to white
    for (let i = 0; i < value * 3; i++) {
      newPlayerColorAttr.array[i] = 1;
    }
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

    // Update map for removed instances
    for (let i = this.innerCount; i > value; i--) {
      const id = this.reverseMap[i];
      delete this.map[id];
    }
    if (this.innerCount > value) this.reverseMap.splice(value);

    this.innerCount = value;
    // InstancedMesh.count is the actual count used for rendering
    // deno-lint-ignore no-explicit-any
    (this as any).count = value;
  }

  getCount() {
    return this.innerCount;
  }

  delete(id: string) {
    if (!(id in this.map)) return;
    const index = this.map[id];
    const swapIndex = this.reverseMap.length - 1;

    if (swapIndex !== index) {
      const swapId = this.reverseMap[swapIndex];

      this.getMatrixAt(swapIndex, dummy.matrix);
      this.setMatrixAtIndex(index, dummy.matrix);

      this.setPositionAt(swapId, Infinity, Infinity, undefined, Infinity);

      if (this.instanceColor?.array) {
        this.getColorAt(swapIndex, dummyColor);
        this.setColorAt(index, dummyColor);
        this.instanceColor.needsUpdate = true;
      }

      const instanceAlphaAttr = this.geometry.getAttribute("instanceAlpha");
      instanceAlphaAttr.setX(index, instanceAlphaAttr.getX(swapIndex));
      instanceAlphaAttr.needsUpdate = true;

      const instanceMinimapMaskAttr = this.geometry.getAttribute(
        "instanceMinimapMask",
      );
      instanceMinimapMaskAttr.setX(
        index,
        instanceMinimapMaskAttr.getX(swapIndex),
      );
      instanceMinimapMaskAttr.needsUpdate = true;

      const instancePlayerColorAttr = this.geometry.getAttribute(
        "instancePlayerColor",
      );
      instancePlayerColorAttr.setXYZ(
        index,
        instancePlayerColorAttr.getX(swapIndex),
        instancePlayerColorAttr.getY(swapIndex),
        instancePlayerColorAttr.getZ(swapIndex),
      );
      instancePlayerColorAttr.needsUpdate = true;

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

    // Initialize new instance with default values
    dummy.matrix.identity();
    this.setMatrixAtIndex(index, dummy.matrix);

    // Reset instance color to white if instance colors are initialized
    if (this.instanceColor) {
      this.setColorAt(index, new Color(1, 1, 1));
      this.instanceColor.needsUpdate = true;
    }

    const instanceAlphaAttr = this.geometry.getAttribute("instanceAlpha");
    instanceAlphaAttr.setX(index, 1);
    instanceAlphaAttr.needsUpdate = true;

    const instanceMinimapMaskAttr = this.geometry.getAttribute(
      "instanceMinimapMask",
    );
    instanceMinimapMaskAttr.setX(index, 0);
    instanceMinimapMaskAttr.needsUpdate = true;

    const instancePlayerColorAttr = this.geometry.getAttribute(
      "instancePlayerColor",
    );
    instancePlayerColorAttr.setXYZ(index, 1, 1, 1);
    instancePlayerColorAttr.needsUpdate = true;

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
    // Skip BVH updates for layer 2 (doodads) - they don't need raycasting
    if (this.layers.mask & 4 && !editorVar()) return;

    if (!this.isFiniteMatrix(matrix)) {
      this.bvh.removeInstance(index);
    } else {
      const bbox = this.computeInstanceBoundingBox(index);
      this.bvh.addOrUpdateInstance(index, bbox);
    }
  }

  private patchBounds() {
    // deno-lint-ignore no-this-alias
    const self = this;

    this.computeBoundingBox = function () {
      const geometry = this.geometry;

      if (this.boundingBox === null) {
        this.boundingBox = new Box3();
      }

      if (geometry.boundingBox === null) {
        geometry.computeBoundingBox();
      }

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

  private debouncingBoundingBox = false;
  private debouncedComputeBoundingBox() {
    if (this.shouldSkipBoundsRecalc()) return;
    if (this.debouncingBoundingBox) return;
    this.debouncingBoundingBox = true;
    queueMicrotask(() => {
      this.debouncingBoundingBox = false;
      this.computeBoundingBox();
    });
  }

  private debouncingBoundingSphere = false;
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

  private initializeInstanceColorWithWhite() {
    if (!this.instanceColor) {
      const white = new Color(1, 1, 1);
      for (let i = 0; i < this.getCount(); i++) {
        this.setColorAt(i, white);
      }
    }
  }

  setPlayerColorAt(index: number | string, color: Color) {
    if (typeof index === "string") index = this.getIndex(index);
    // Set the player color which only applies to player-masked vertices
    const playerColorAttr = this.geometry.getAttribute("instancePlayerColor");
    playerColorAttr.setXYZ(index, color.r, color.g, color.b);
    playerColorAttr.needsUpdate = true;
  }

  setVertexColorAt(index: number | string, color: Color) {
    if (typeof index === "string") index = this.getIndex(index);
    // Set the instance color which applies to ALL vertices
    this.initializeInstanceColorWithWhite();
    this.setColorAt(index, color);
    if (this.instanceColor) this.instanceColor.needsUpdate = true;
  }

  setAlphaAt(index: number | string, alpha: number, progressiveAlpha = false) {
    if (typeof index === "string") index = this.getIndex(index);
    const instanceAlphaAttr = this.geometry.getAttribute("instanceAlpha");
    // Encode progressive mode: values > 1.0 = progressive (add 2 so alpha=0 encodes as 2)
    const encodedAlpha = progressiveAlpha ? alpha + 2 : alpha;
    instanceAlphaAttr.setX(index, encodedAlpha);
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

  saveInstanceColors(index: number | string): Color | null {
    if (typeof index === "string") index = this.getIndex(index);
    if (this.instanceColor) {
      const savedColor = new Color();
      this.getColorAt(index, savedColor);
      return savedColor;
    }
    return null;
  }

  restoreInstanceColors(index: number | string, color: Color | null) {
    if (typeof index === "string") index = this.getIndex(index);
    if (color) {
      this.setColorAt(index, color);
      if (this.instanceColor) this.instanceColor.needsUpdate = true;
    }
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
    if (!geoBox) {
      this.geometry.computeBoundingBox();
    }

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
