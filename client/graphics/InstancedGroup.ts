import {
  Color,
  Group,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  Object3D,
} from "three";

const dummy = new Object3D();
const dummyColor = new Color();

const white = new Color("white");

const hasPlayerColor = (material: Material | Material[]) =>
  Array.isArray(material)
    ? material.some((m: Material) => m.userData.player)
    : (material as Material).userData.player;

export class InstancedGroup extends Group {
  private map: Record<string, number> = {};
  private reverseMap: string[] = [];
  private innerCount: number;

  constructor(group: Group, count: number = 1) {
    super();
    this.innerCount = count;
    for (const child of group.children) {
      if (child instanceof Mesh) {
        const mesh = new InstancedMesh(
          child.geometry,
          child.material,
          count,
        );
        this.children.push(mesh);
        mesh.layers.mask = this.layers.mask;
      }
    }
    for (let i = 0; i < count; i++) {
      this.setPositionAt(i, Infinity, Infinity);
    }
  }

  set count(value: number) {
    const next = this.children.map((c) => {
      if (!(c instanceof InstancedMesh)) return c;
      const next = new InstancedMesh(c.geometry, c.material, value);
      next.layers.mask = this.layers.mask;
      for (let i = 0; i < value; i++) {
        next.instanceMatrix.copyArray(c.instanceMatrix.array);
        dummy.matrix.setPosition(Infinity, Infinity, Infinity);
        for (let i = this.innerCount; i < value; i++) {
          next.setMatrixAt(i, dummy.matrix);
        }

        if (c.instanceColor) {
          // Ensure it exists
          next.setColorAt(0, new Color(0, 0, 0));
          next.instanceColor!.copyArray(c.instanceColor.array);
        }
      }
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

    let swapIndex = this.reverseMap.length - 1;

    if (swapIndex !== index) {
      const swapId = this.reverseMap[swapIndex];

      const matrixInstancedMesh = this.children.find((c): c is InstancedMesh =>
        c instanceof InstancedMesh
      );
      if (matrixInstancedMesh) {
        matrixInstancedMesh.getMatrixAt(swapIndex, dummy.matrix);
        this.setMatrixAt(id, dummy.matrix);
      }

      this.setPositionAt(swapId, Infinity, Infinity);

      const colorInstancedMesh = this.children.find((c): c is InstancedMesh =>
        c instanceof InstancedMesh &&
        hasPlayerColor(c.material)
      );
      if (colorInstancedMesh) {
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
    return index;
  }

  getId(index: number): string | undefined {
    return this.reverseMap[index];
  }

  setMatrixAt(index: number | string, matrix: Matrix4) {
    if (typeof index === "string") index = this.getIndex(index);
    for (const child of this.children) {
      if (child instanceof InstancedMesh) {
        child.setMatrixAt(index, matrix);
        child.instanceMatrix.needsUpdate = true;
      }
    }
  }

  setPositionAt(index: number | string, x: number, y: number) {
    if (typeof index === "string") index = this.getIndex(index);
    for (const child of this.children) {
      if (child instanceof InstancedMesh) {
        child.getMatrixAt(index, dummy.matrix);
        dummy.matrix.decompose(
          dummy.position,
          dummy.quaternion,
          dummy.scale,
        );
        // Applies to structures; should maybe ignore when coming from an update?
        if (dummy.position.x - 1e-5 > x && dummy.scale.x !== 1) {
          dummy.scale.x = 1;
        } else if (dummy.position.x + 1e-5 < x && dummy.scale.x !== -1) {
          dummy.scale.x = -1;
        }
        dummy.position.set(x, y, 0);
        dummy.updateMatrix();
        child.setMatrixAt(index, dummy.matrix);
        child.instanceMatrix.needsUpdate = true;
        child.computeBoundingBox();
        child.computeBoundingSphere();
      }
    }
  }

  setPlayerColorAt(
    index: number | string,
    color: Color,
    overrideVertex = true,
  ) {
    if (typeof index === "string") index = this.getIndex(index);
    for (const child of this.children) {
      if (child instanceof InstancedMesh) {
        if (hasPlayerColor(child.material)) {
          child.setColorAt(index, color);
          if (child.instanceColor) child.instanceColor.needsUpdate = true;
        } else if (overrideVertex) {
          child.setColorAt(index, white);
          if (child.instanceColor) child.instanceColor.needsUpdate = true;
        }
      }
    }
  }

  setVertexColorAt(index: number | string, color: Color) {
    if (typeof index === "string") index = this.getIndex(index);
    for (const child of this.children) {
      if (child instanceof InstancedMesh) {
        child.setColorAt(index, color);
        if (child.instanceColor) child.instanceColor.needsUpdate = true;
      }
    }
  }
}
