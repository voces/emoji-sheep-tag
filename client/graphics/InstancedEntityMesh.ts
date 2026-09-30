import {
  Box3,
  type BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  type InterleavedBufferAttribute,
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
import { instanceZ, type SpriteSort } from "./depthSort.ts";

/** A per-instance attribute and the value each new instance starts with. */
export type InstanceAttribute = {
  name: string;
  itemSize: number;
  fill: readonly number[];
};

const dummy = new Object3D();
const _matrix = new Matrix4();
const _instanceBox = new Box3();
const _box = new Box3();
const _sphere = new Sphere();
const _ray = new Ray();
const _point = new Vector3();

const hidden = new Matrix4().makeTranslation(Infinity, Infinity, Infinity);

const SHARED_ATTRIBUTES: readonly InstanceAttribute[] = [
  { name: "instanceAlpha", itemSize: 1, fill: [1] },
  // Packs the minimap flag (a +4 offset) with submergence in [0, 4) beneath
  // it. Float storage keeps submergence precise and lets it pass 1.0 for
  // entities sitting in water deeper than their radius.
  { name: "instanceMinimapMask", itemSize: 1, fill: [0] },
  { name: "instancePlayerColor", itemSize: 3, fill: [1, 1, 1] },
];

/**
 * Alpha below this draws in the translucent pass, matching the split the
 * sprite shaders make. Encoded values above 1 are InstancedSvg's progressive
 * build alpha, which also draws there.
 */
const isTranslucentAlpha = (encoded: number) => encoded > 1 || encoded < 0.999;

const isFiniteMatrix = (m: Matrix4) =>
  Number.isFinite(m.elements[12]) && Number.isFinite(m.elements[13]) &&
  Number.isFinite(m.elements[14]);

/**
 * Makes an attribute for `count` instances filled with the attribute's
 * defaults, keeping the first `keep` instances of `previous`.
 */
export const createInstanceAttribute = (
  count: number,
  { itemSize, fill }: InstanceAttribute,
  previous?: BufferAttribute | InterleavedBufferAttribute | null,
  keep = 0,
) => {
  const array = new Float32Array(count * itemSize);
  const kept = previous ? Math.min(count, keep) * itemSize : 0;
  for (let i = 0; i < array.length; i++) {
    array[i] = previous && i < kept ? previous.array[i] : fill[i % itemSize];
  }
  const attribute = new InstancedBufferAttribute(array, itemSize);
  attribute.setUsage(DynamicDrawUsage);
  return attribute;
};

/**
 * An instanced mesh of entity sprites addressed by entity id: it grows as ids
 * arrive, swaps the last instance into a deleted one's slot, keeps a BVH for
 * picking, and draws see-through instances in separate pass meshes.
 */
export abstract class InstancedEntityMesh extends InstancedMesh {
  private map: Record<string, number> = {};
  private reverseMap: string[] = [];
  private readonly bvh: BVH;
  private readonly instanceAttributes: readonly InstanceAttribute[];
  protected readonly sort: SpriteSort | undefined;
  protected translucentInstances = 0;

  constructor(
    geometry: BufferGeometry,
    material: Material,
    count: number,
    { name, attributes, sort }: {
      name?: string;
      /** Per-instance attributes beyond alpha, minimap mask and player colour. */
      attributes: readonly InstanceAttribute[];
      sort?: SpriteSort;
    },
  ) {
    super(geometry, material, count);
    this.sort = sort;
    this.instanceAttributes = [...SHARED_ATTRIBUTES, ...attributes];
    for (const attribute of this.instanceAttributes) {
      geometry.setAttribute(
        attribute.name,
        createInstanceAttribute(count, attribute),
      );
    }

    this.bvh = new BVH(name);
    this.bvh.setGetBoundingBox((index) => {
      this.getMatrixAt(index, _matrix);
      return isFiniteMatrix(_matrix) ? this.instanceBox(_matrix) : null;
    });

    for (let i = 0; i < count; i++) {
      this.setPositionAt(i, Infinity, Infinity, undefined, Infinity);
    }
  }

  /** Points the pass meshes at the current instances and shows the ones needed. */
  protected abstract syncPassMeshes(): void;

  resize(value: number) {
    const kept = Math.min(value, this.count);
    const matrices = new Float32Array(value * 16);
    matrices.set(this.instanceMatrix.array.subarray(0, kept * 16));
    for (let n = kept; n < value; n++) hidden.toArray(matrices, n * 16);
    this.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
    this.instanceMatrix.setUsage(DynamicDrawUsage);

    for (const attribute of this.instanceAttributes) {
      this.geometry.setAttribute(
        attribute.name,
        createInstanceAttribute(
          value,
          attribute,
          this.geometry.getAttribute(attribute.name),
          kept,
        ),
      );
    }

    for (const id of this.reverseMap.splice(value)) delete this.map[id];

    this.count = value;
    this.syncPassMeshes();
  }

  getCount() {
    return this.count;
  }

  getId(index: number): string | undefined {
    return this.reverseMap[index];
  }

  delete(id: string) {
    if (!(id in this.map)) return;
    const index = this.map[id];
    const swapIndex = this.reverseMap.length - 1;

    if (this.isTranslucentAt(index)) {
      this.translucentInstances--;
      this.syncPassMeshes();
    }

    if (swapIndex !== index) {
      const swapId = this.reverseMap[swapIndex];

      this.getMatrixAt(swapIndex, dummy.matrix);
      this.setMatrixAtIndex(index, dummy.matrix);
      this.setPositionAt(swapId, Infinity, Infinity, undefined, Infinity);
      this.copyInstance(swapIndex, index);

      this.map[swapId] = index;
      this.reverseMap[index] = swapId;
    } else this.setMatrixAtIndex(index, hidden);

    delete this.map[id];
    this.reverseMap.pop();
  }

  /** Copies every per-instance value but the matrix from one slot to another. */
  protected copyInstance(from: number, to: number) {
    for (const { name, itemSize } of this.instanceAttributes) {
      const attribute = this.geometry.getAttribute(name);
      for (let c = 0; c < itemSize; c++) {
        attribute.array[to * itemSize + c] =
          attribute.array[from * itemSize + c];
      }
      attribute.needsUpdate = true;
    }
  }

  /** Gives a slot every attribute's default. */
  protected resetInstance(index: number) {
    for (const { name, itemSize, fill } of this.instanceAttributes) {
      const attribute = this.geometry.getAttribute(name);
      for (let c = 0; c < itemSize; c++) {
        attribute.array[index * itemSize + c] = fill[c];
      }
      attribute.needsUpdate = true;
    }
  }

  private getIndex(id: string) {
    if (id in this.map) return this.map[id];
    const index = this.reverseMap.push(id) - 1;
    this.map[id] = index;
    if (index + 1 > this.getCount()) this.resize((index + 1) * 2);

    this.setMatrixAtIndex(index, _matrix.identity());
    this.resetInstance(index);

    return index;
  }

  /** The slot of an entity id, taking one if it has none; a slot passes through. */
  protected resolveIndex(index: number | string) {
    return typeof index === "string" ? this.getIndex(index) : index;
  }

  private setMatrixAtIndex(index: number, matrix: Matrix4) {
    this.setMatrixAt(index, matrix);
    this.instanceMatrix.needsUpdate = true;
    this.invalidateBounds();
    this.updateBvhInstance(index, matrix);
  }

  private updateBvhInstance(index: number, matrix: Matrix4) {
    // Doodads (layer 2) are only picked in the editor
    if (this.layers.mask & 4 && !editorVar()) return;
    this.bvh.queueUpdate(
      index,
      isFiniteMatrix(matrix) ? this.instanceBox(matrix) : null,
    );
  }

  /**
   * Drops the mesh-wide bounds, so the renderer recomputes them once, when it
   * next culls, however many instances moved since.
   */
  private invalidateBounds() {
    this.boundingBox = null;
    this.boundingSphere = null;
  }

  override computeBoundingBox() {
    const geometry = this.geometry;
    this.boundingBox ??= new Box3();
    if (geometry.boundingBox === null) geometry.computeBoundingBox();
    this.boundingBox.makeEmpty();

    for (let i = 0; i < this.count; i++) {
      this.getMatrixAt(i, _matrix);
      if (!isFiniteMatrix(_matrix)) continue;
      this.boundingBox.union(
        _box.copy(geometry.boundingBox!).applyMatrix4(_matrix),
      );
    }
  }

  override computeBoundingSphere() {
    const geometry = this.geometry;
    this.boundingSphere ??= new Sphere();
    if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
    this.boundingSphere.makeEmpty();

    for (let i = 0; i < this.count; i++) {
      this.getMatrixAt(i, _matrix);
      if (!isFiniteMatrix(_matrix)) continue;
      this.boundingSphere.union(
        _sphere.copy(geometry.boundingSphere!).applyMatrix4(_matrix),
      );
    }
  }

  /** The instance's box for a matrix, in a scratch box the next call reuses. */
  private instanceBox(matrix: Matrix4) {
    if (!this.geometry.boundingBox) this.geometry.computeBoundingBox();
    return _instanceBox.copy(this.geometry.boundingBox!).applyMatrix4(matrix);
  }

  setPositionAt(
    index: number | string,
    x: number,
    y: number,
    angle?: number | null,
    z?: number,
  ) {
    index = this.resolveIndex(index);

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
      instanceZ(this.sort, x, y, dummy.scale.y, z ?? dummy.position.z),
    );
    dummy.updateMatrix();

    this.setMatrixAtIndex(index, dummy.matrix);
  }

  getPositionAt(index: number | string) {
    this.getMatrixAt(this.resolveIndex(index), dummy.matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
    return dummy.position.clone();
  }

  setScaleAt(index: number | string, scale: number, aspectRatio?: number) {
    index = this.resolveIndex(index);

    this.getMatrixAt(index, dummy.matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
    dummy.scale.setScalar(scale);
    if (typeof aspectRatio === "number") {
      dummy.scale.setY(dummy.scale.y * aspectRatio);
    }
    dummy.position.z = instanceZ(
      this.sort,
      dummy.position.x,
      dummy.position.y,
      dummy.scale.y,
      dummy.position.z,
    );
    dummy.updateMatrix();

    this.setMatrixAtIndex(index, dummy.matrix);
  }

  /** Colours the vertices marked as the player's. */
  setPlayerColorAt(index: number | string, color: Color) {
    const attribute = this.geometry.getAttribute("instancePlayerColor");
    attribute.setXYZ(this.resolveIndex(index), color.r, color.g, color.b);
    attribute.needsUpdate = true;
  }

  protected isTranslucentAt(index: number) {
    return isTranslucentAlpha(
      this.geometry.getAttribute("instanceAlpha").getX(index),
    );
  }

  setAlphaAt(index: number | string, alpha: number) {
    index = this.resolveIndex(index);
    const attribute = this.geometry.getAttribute("instanceAlpha");
    const wasTranslucent = this.isTranslucentAt(index);
    attribute.setX(index, alpha);
    attribute.needsUpdate = true;
    const isTranslucent = this.isTranslucentAt(index);
    if (wasTranslucent === isTranslucent) return;
    this.translucentInstances += isTranslucent ? 1 : -1;
    this.syncPassMeshes();
  }

  setSubmergenceAt(index: number | string, submergence: number) {
    index = this.resolveIndex(index);
    const attribute = this.geometry.getAttribute("instanceMinimapMask");
    const maskBits = attribute.getX(index) >= 4 ? 4 : 0;
    attribute.setX(index, maskBits + Math.max(0, Math.min(3.9, submergence)));
    attribute.needsUpdate = true;
  }

  setMinimapMaskAt(index: number | string, maskValue: number) {
    index = this.resolveIndex(index);
    const attribute = this.geometry.getAttribute("instanceMinimapMask");
    const current = attribute.getX(index);
    const subValue = current >= 4 ? current - 4 : current;
    attribute.setX(index, (maskValue > 0.5 ? 4 : 0) + subValue);
    attribute.needsUpdate = true;
  }

  override raycast(raycaster: Raycaster, intersects: Intersection[]) {
    _ray.copy(raycaster.ray);
    for (const candidate of this.bvh.raycast(_ray)) {
      intersects.push({
        distance: -this.renderOrder,
        point: _point,
        object: this,
        instanceId: candidate,
      });
    }
  }
}
