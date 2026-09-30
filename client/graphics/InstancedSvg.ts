import { staticInstances } from "./staticMeshes.ts";
import {
  BufferGeometry,
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Material,
} from "three";
import { mergeGeometries } from "three/BufferGeometryUtils";
import type { SpriteSort } from "./depthSort.ts";
import {
  createInstanceAttribute,
  type InstanceAttribute,
  InstancedEntityMesh,
} from "./InstancedEntityMesh.ts";

const INSTANCE_COLOR: InstanceAttribute = {
  name: "instanceColor",
  itemSize: 3,
  fill: [1, 1, 1],
};

export class InstancedSvg extends InstancedEntityMesh {
  // Tints from the start, all white: three builds instanced meshes with and
  // without a tint separate programs, and one compiled ahead untinted would
  // leave the tinted one, a build ghost say, to compile as it first draws
  declare instanceColor: InstancedBufferAttribute;
  /** Draws see-through instances after every opaque sprite, without writing depth. */
  readonly translucentMesh: InstancedMesh;
  private readonly hasTranslucentShapes: boolean;

  constructor(
    geometries: BufferGeometry[],
    material: Material,
    count: number = 1,
    readonly svgName?: string,
    options?: {
      skipBoundsRecalc?: boolean;
      mapUtilizationThreshold?: number;
      /** Sorts instances by position; unsorted meshes draw in render order. */
      sort?: SpriteSort;
      translucentMaterial?: Material;
    },
  ) {
    const mergedGeometry = mergeGeometries(geometries, false);
    if (!mergedGeometry) throw new Error("Failed to merge geometries");

    super(mergedGeometry, material, count, {
      name: svgName,
      attributes: [],
      sort: options?.sort,
      skipBoundsRecalc: options?.skipBoundsRecalc,
      mapUtilizationThreshold: options?.mapUtilizationThreshold,
    });
    staticInstances(this);

    this.instanceColor = createInstanceAttribute(count, INSTANCE_COLOR);

    this.hasTranslucentShapes = geometries.some((geo) => {
      const opacities = geo.getAttribute("vertexOpacity")?.array;
      return !!opacities &&
        Array.from(opacities).some((o) => (o > 1 ? o - 2 : o) < 0.999);
    });
    this.translucentMesh = staticInstances(
      new InstancedMesh(
        mergedGeometry,
        options?.translucentMaterial ?? material,
        count,
      ),
    );
    this.translucentMesh.frustumCulled = false;
    this.translucentMesh.raycast = () => {};
    this.syncPassMeshes();
  }

  override resize(value: number) {
    this.instanceColor = createInstanceAttribute(
      value,
      INSTANCE_COLOR,
      this.instanceColor,
      this.getCount(),
    );
    super.resize(value);
  }

  protected syncPassMeshes() {
    this.translucentMesh.instanceMatrix = this.instanceMatrix;
    this.translucentMesh.instanceColor = this.instanceColor;
    this.translucentMesh.count = this.count;
    this.translucentMesh.visible = this.visible &&
      this.translucentMesh.material !== this.material &&
      (this.hasTranslucentShapes || this.translucentInstances > 0);
  }

  protected override copyInstance(from: number, to: number) {
    super.copyInstance(from, to);
    this.instanceColor.copyAt(to, this.instanceColor, from);
    this.instanceColor.needsUpdate = true;
  }

  protected override resetInstance(index: number) {
    super.resetInstance(index);
    this.instanceColor.setXYZ(index, 1, 1, 1);
    this.instanceColor.needsUpdate = true;
  }

  /** Tints every vertex. */
  setVertexColorAt(index: number | string, color: Color) {
    this.setColorAt(this.resolveIndex(index), color);
    this.instanceColor.needsUpdate = true;
  }

  /**
   * With `progressiveAlpha`, reveals the sprite's shapes in turn as alpha
   * climbs, for buildings under construction; it's encoded as alpha + 2.
   */
  override setAlphaAt(
    index: number | string,
    alpha: number,
    progressiveAlpha = false,
  ) {
    super.setAlphaAt(index, progressiveAlpha ? alpha + 2 : alpha);
  }

  saveInstanceColors(index: number | string): Color | null {
    const savedColor = new Color();
    this.getColorAt(this.resolveIndex(index), savedColor);
    return savedColor;
  }

  restoreInstanceColors(index: number | string, color: Color | null) {
    index = this.resolveIndex(index);
    if (!color) return;
    this.setColorAt(index, color);
    this.instanceColor.needsUpdate = true;
  }
}
