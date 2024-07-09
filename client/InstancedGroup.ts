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

export class InstancedGroup extends Group {
  private map: Record<string, number> = {};
  private innerCount: number;

  constructor(group: Group, count: number = 1) {
    super();
    this.innerCount = count;
    for (const child of group.children) {
      if (child instanceof Mesh) {
        this.children.push(
          new InstancedMesh(
            child.geometry,
            child.material,
            count,
          ),
        );
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
      for (let i = 0; i < Math.min(value, this.innerCount); i++) {
        c.getMatrixAt(i, next.matrix);
        if (c.instanceColor) {
          // Ensure it exists
          next.setColorAt(0, new Color(0, 0, 0));
          next.instanceColor!.copyArray(c.instanceColor.array);
        }
      }
      return next;
    });
    this.innerCount = value;
    super.clear();
    this.add(...next);
  }

  get count() {
    return this.innerCount;
  }

  clear() {
    this.count = 0;
    this.map = {};
    return this;
  }

  getIndex(id: string) {
    if (id in this.map) return this.map[id];
    return this.map[id] = this.count++;
  }

  setMatrixAt(index: number | string, matrix: Matrix4) {
    if (typeof index === "string") index = this.getIndex(index);
    if (index) {
      for (const child of this.children) {
        if (child instanceof InstancedMesh) {
          child.setMatrixAt(index, matrix);
          child.instanceMatrix.needsUpdate = true;
        }
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
        dummy.scale.x = dummy.position.x > x ? 1 : -1;
        dummy.position.set(x, y, 0);
        dummy.updateMatrix();
        child.setMatrixAt(index, dummy.matrix);
        child.instanceMatrix.needsUpdate = true;
      }
    }
  }

  setColorAt(index: number | string, color: Color) {
    if (typeof index === "string") index = this.getIndex(index);
    for (const child of this.children) {
      if (child instanceof InstancedMesh) {
        if (
          Array.isArray(child.material)
            ? child.material.some((m: Material) => m.userData.player)
            : (child.material as Material).userData.player
        ) {
          child.setColorAt(index, color);
          if (child.instanceColor) {
            child.instanceColor.needsUpdate = true;
          }
        }
      }
    }
  }
}
