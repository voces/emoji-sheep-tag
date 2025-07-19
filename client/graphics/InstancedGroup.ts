import {
  Box3,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Intersection,
  Material,
  Matrix4,
  Mesh,
  Object3D,
  Ray,
  Raycaster,
  ShapeGeometry,
} from "three";
import { normalizeAngle } from "../../shared/pathing/math.ts";
import { BVH } from "./BVH.ts";

const dummy = new Object3D();
const dummyColor = new Color();

const white = new Color("white");

const hasPlayerColor = (material: Material | Material[]) =>
  Array.isArray(material)
    ? material.some((m: Material) => m.userData.player)
    : (material as Material).userData.player;

const _tempBox = new Box3();

export class InstancedGroup extends Group {
  private map: Record<string, number> = {};
  private reverseMap: string[] = [];
  private innerCount: number;
  private bvh = new BVH();

  constructor(group: Group, count: number = 1, readonly svgName?: string) {
    super();
    this.innerCount = count;
    for (const child of group.children) {
      if (child instanceof Mesh) {
        const mesh = new InstancedMesh(child.geometry, child.material, count);
        const instanceAlphaAttr = new InstancedBufferAttribute(
          new Float32Array(count),
          1,
        );
        // instanceAlphaAttr.setUsage(DynamicDrawUsage);
        instanceAlphaAttr.array.fill(1);
        (child.geometry as ShapeGeometry).setAttribute(
          "instanceAlpha",
          instanceAlphaAttr,
        );
        this.children.push(mesh);
        mesh.layers.mask = this.layers.mask;
      }
    }
    for (let i = 0; i < count; i++) {
      this.setPositionAt(i, Infinity, Infinity, undefined, Infinity);
    }
  }

  set count(value: number) {
    const next = this.children.map((c) => {
      if (!(c instanceof InstancedMesh)) return c;
      const next = new InstancedMesh(c.geometry, c.material, value);
      next.layers.mask = this.layers.mask;

      next.instanceMatrix.copyArray(c.instanceMatrix.array);
      dummy.matrix.setPosition(Infinity, Infinity, Infinity);
      for (let n = this.innerCount; n < value; n++) {
        next.setMatrixAt(n, dummy.matrix);
      }

      if (c.instanceColor) {
        // Ensure it exists
        next.setColorAt(0, new Color(0, 0, 0));
        next.instanceColor!.copyArray(c.instanceColor.array);
      }

      const geo = next.geometry as ShapeGeometry;
      const oldAttrib = geo.getAttribute("instanceAlpha");
      const newAttrib = new InstancedBufferAttribute(
        new Float32Array(value),
        1,
      );
      newAttrib.array.fill(1);
      newAttrib.copyArray(oldAttrib.array);
      newAttrib.setUsage(DynamicDrawUsage);
      geo.setAttribute("instanceAlpha", newAttrib);

      return next;
    });
    for (let i = this.innerCount; i > value; i--) {
      const id = this.reverseMap[i];
      delete this.map[id];
    }
    if (this.innerCount > value) this.reverseMap.splice(value);
    this.innerCount = value;
    super.clear();
    this.add(...next);
  }

  get count() {
    return this.innerCount;
  }

  override clear() {
    this.count = 0;
    return this;
  }

  delete(id: string) {
    if (!(id in this.map)) return; // do nothing
    const index = this.map[id];

    const swapIndex = this.reverseMap.length - 1;

    if (swapIndex !== index) {
      const swapId = this.reverseMap[swapIndex];

      const matrixInstancedMesh = this.children.find((c): c is InstancedMesh =>
        c instanceof InstancedMesh
      );
      if (matrixInstancedMesh) {
        matrixInstancedMesh.getMatrixAt(swapIndex, dummy.matrix);
        this.setMatrixAt(id, dummy.matrix);
      }

      this.setPositionAt(swapId, Infinity, Infinity, undefined, Infinity);

      const colorInstancedMesh = this.children.find((c): c is InstancedMesh =>
        c instanceof InstancedMesh && hasPlayerColor(c.material)
      );
      if (colorInstancedMesh && colorInstancedMesh.instanceColor?.array) {
        colorInstancedMesh.getColorAt(swapIndex, dummyColor);
        this.setPlayerColorAt(id, dummyColor);
      }

      this.map[swapId] = index;
      this.reverseMap[index] = swapId;
    } else {
      dummy.matrix.setPosition(Infinity, Infinity, Infinity);
      this.setMatrixAt(index, dummy.matrix);
    }

    delete this.map[id];
    this.reverseMap.pop();
  }

  private getIndex(id: string) {
    if (id in this.map) return this.map[id];
    const index = this.reverseMap.push(id) - 1;
    this.map[id] = index;
    if (index + 1 > this.count) this.count = (index + 1) * 2;
    dummy.matrix.identity();
    this.setMatrixAt(index, dummy.matrix);
    return index;
  }

  getId(index: number): string | undefined {
    return this.reverseMap[index];
  }

  private setMatrixAt(index: number | string, matrix: Matrix4) {
    if (typeof index === "string") index = this.getIndex(index);
    for (const child of this.children) {
      if (child instanceof InstancedMesh) {
        child.setMatrixAt(index, matrix);
        child.instanceMatrix.needsUpdate = true;
      }
    }
    this.updateBvhInstance(index, matrix);
  }

  private updateBvhInstance(index: number, matrix: Matrix4) {
    // Check if we should remove or add/update in BVH
    // Detect if matrix is "infinite" - typically you'd check elements or the position
    if (!this.isFiniteMatrix(matrix)) {
      // Remove from BVH
      this.bvh.removeInstance(index);
    } else {
      // Compute bounding box
      const bbox = this.computeInstanceBoundingBox(index);
      // Add or update in BVH
      this.bvh.addOrUpdateInstance(index, bbox);
    }
  }

  setPositionAt(
    index: number | string,
    x: number,
    y: number,
    angle?: number,
    z?: number,
  ) {
    if (typeof index === "string") index = this.getIndex(index);
    for (const child of this.children) {
      if (child instanceof InstancedMesh) {
        child.getMatrixAt(index, dummy.matrix);
        dummy.matrix.decompose(
          dummy.position,
          dummy.quaternion,
          dummy.scale,
        );
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
        child.setMatrixAt(index, dummy.matrix);
        child.instanceMatrix.needsUpdate = true;
        child.computeBoundingBox();
        child.computeBoundingSphere();
      }
    }
    this.updateBvhInstance(index, dummy.matrix);
  }

  getPositionAt(index: number | string) {
    if (typeof index === "string") index = this.getIndex(index);
    for (const child of this.children) {
      if (child instanceof InstancedMesh) {
        child.getMatrixAt(index, dummy.matrix);
        dummy.matrix.decompose(
          dummy.position,
          dummy.quaternion,
          dummy.scale,
        );
        return dummy.position.clone();
      }
    }
  }

  setPlayerColorAt(
    index: number | string,
    color: Color,
    { overrideVertex = true, alpha = 1, progressiveAlpha = false }: {
      overrideVertex?: boolean;
      alpha?: number;
      /** Apply alpha element by element. */
      progressiveAlpha?: boolean;
    } = {},
  ) {
    if (typeof index === "string") index = this.getIndex(index);
    const step = progressiveAlpha ? 1 / this.children.length : 1;
    for (const child of this.children) {
      if (child instanceof InstancedMesh) {
        if (hasPlayerColor(child.material)) {
          child.setColorAt(index, color);
          if (child.instanceColor) child.instanceColor.needsUpdate = true;
        } else if (overrideVertex) {
          child.setColorAt(index, white);
          if (child.instanceColor) child.instanceColor.needsUpdate = true;
        }
        if (overrideVertex) {
          const instanceAlphaAttr = (child.geometry as ShapeGeometry)
            .getAttribute("instanceAlpha");
          instanceAlphaAttr.setX(index, alpha > step ? 1 : alpha / step);
          if (progressiveAlpha) alpha = Math.max(0, alpha - step);
          instanceAlphaAttr.needsUpdate = true;
        }
      }
    }
  }

  setVertexColorAt(
    index: number | string,
    color: Color,
    { alpha = 1, progressiveAlpha = false }: {
      alpha?: number;
      /** Apply alpha element by element. */
      progressiveAlpha?: boolean;
    } = {},
  ) {
    if (typeof index === "string") index = this.getIndex(index);
    const step = progressiveAlpha ? 1 / this.children.length : 1;
    for (const child of this.children) {
      if (child instanceof InstancedMesh) {
        child.setColorAt(index, color);
        if (child.instanceColor) child.instanceColor.needsUpdate = true;
        const instanceAlphaAttr = (child.geometry as ShapeGeometry)
          .getAttribute("instanceAlpha");
        instanceAlphaAttr.setX(index, alpha > step ? 1 : alpha / step);
        if (progressiveAlpha) alpha = Math.max(0, alpha - step);
        instanceAlphaAttr.needsUpdate = true;
      }
    }
  }

  setAlphaAt(
    index: number | string,
    alpha: number,
    progressiveAlpha = false,
  ) {
    if (typeof index === "string") index = this.getIndex(index);
    const step = progressiveAlpha ? 1 / this.children.length : 1;
    for (const child of this.children) {
      if (child instanceof InstancedMesh) {
        const instanceAlphaAttr = (child.geometry as ShapeGeometry)
          .getAttribute("instanceAlpha");
        instanceAlphaAttr.setX(index, alpha > step ? 1 : alpha / step);
        if (progressiveAlpha) alpha = Math.max(0, alpha - step);
        instanceAlphaAttr.needsUpdate = true;
      }
    }
  }

  setScaleAt(index: number | string, scale: number) {
    if (typeof index === "string") index = this.getIndex(index);
    for (const child of this.children) {
      if (child instanceof InstancedMesh) {
        child.getMatrixAt(index, dummy.matrix);
        dummy.matrix.decompose(
          dummy.position,
          dummy.quaternion,
          dummy.scale,
        );
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        child.setMatrixAt(index, dummy.matrix);
        child.instanceMatrix.needsUpdate = true;
        child.computeBoundingBox();
        child.computeBoundingSphere();
      }
    }
    this.updateBvhInstance(index, dummy.matrix);
  }

  // Utility: compute the bounding box for a single instance index
  // by unioning the bounding boxes of all children for that instance.
  private computeInstanceBoundingBox(index: number): Box3 {
    let first = true;
    _tempBox.makeEmpty();

    for (const child of this.children) {
      if (child instanceof InstancedMesh) {
        // Each child has the same number of instances
        // Get the child's geometry bounding box
        const geoBox = child.geometry.boundingBox || (() => {
          throw new Error(
            "Expected child geometry to have bounding box precomputed",
          );
        });
        // this.computeGeometryBoundingBox(child.geometry);

        // Apply the instance's matrix to the geometry bounding box
        const matrix = new Matrix4();
        child.getMatrixAt(index, matrix);

        const transformedBox = new Box3().copy(geoBox).applyMatrix4(matrix);
        if (first) {
          _tempBox.copy(transformedBox);
          first = false;
        } else {
          _tempBox.union(transformedBox);
        }
      }
    }

    return _tempBox.clone();
  }

  private isFiniteMatrix(m: Matrix4): boolean {
    // Check the position or any element if it's infinite
    // We'll just check translation components (m.elements[12,13,14]) for simplicity
    const e = m.elements;
    return Number.isFinite(e[12]) && Number.isFinite(e[13]) &&
      Number.isFinite(e[14]);
  }

  // Raycast override:
  // We use our BVH to find candidate instances that might intersect the ray.
  // Then we do a more detailed intersection test on those instances.
  override raycast(raycaster: Raycaster, intersects: Intersection[]) {
    // Convert raycaster to a Ray in world space
    const ray = new Ray().copy(raycaster.ray);

    // Query the BVH for candidate instances
    const candidates = this.bvh.raycast(ray);

    for (const candidate of candidates) {
      // For each candidate instance, test intersection against all children:
      for (const child of this.children) {
        if (child instanceof InstancedMesh) {
          // Get the matrix for this instance
          const instanceMatrix = new Matrix4();
          child.getMatrixAt(candidate, instanceMatrix);

          // We need to transform the ray into the instance's local space
          const invMat = new Matrix4().copy(instanceMatrix).invert();
          const localRay = new Ray().copy(ray).applyMatrix4(invMat);

          // Perform intersection test with child's geometry
          this.raycastInstancedMesh(
            child,
            localRay,
            candidate,
            raycaster,
            intersects,
          );
        }
      }
    }

    return false;
  }

  // Raycast against an individual InstancedMesh instance
  private raycastInstancedMesh(
    instMesh: InstancedMesh,
    localRay: Ray,
    index: number,
    raycaster: Raycaster,
    intersects: Intersection[],
  ) {
    // Reuse or create a Mesh with the same geometry and material to use the built-in intersect
    // Transform is already baked into localRay, so treat geometry as if at origin.
    const testMesh = new Mesh(instMesh.geometry, instMesh.material as Material);
    const localIntersects: Intersection[] = [];
    testMesh.raycast(
      { ...raycaster, ray: localRay } as Raycaster,
      localIntersects,
    );

    // Transform intersection points back to world space and add to final intersects
    if (localIntersects.length > 0) {
      const instanceMatrix = new Matrix4();
      instMesh.getMatrixAt(index, instanceMatrix);

      for (const hit of localIntersects) {
        hit.point.applyMatrix4(instanceMatrix);
        hit.object = this; // The object hit is the InstancedGroup itself, or keep as instMesh if desired
        hit.instanceId = index; // Keep track of which instance was hit
        intersects.push(hit);
      }
    }
  }
}
