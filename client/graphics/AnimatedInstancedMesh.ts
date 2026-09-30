/**
 * AnimatedInstancedMesh - Instanced mesh with GPU-driven part-based animation.
 *
 * Animation is entirely GPU-side:
 * - Each vertex has a partID attribute
 * - Per-instance: animClip, animPhase, animSpeed
 * - Shader samples transform/opacity textures based on uTime
 */

import { staticInstances } from "./staticMeshes.ts";
import { BufferGeometry, Color, InstancedMesh, Material } from "three";
import type { AnimationData, ParsedCamera } from "./loadEstb.ts";
import {
  createDepthMaterial,
  getShaderRefs,
  onShaderReady,
} from "./AnimatedMeshMaterial.ts";
import type { SpriteSort } from "./depthSort.ts";
import {
  type InstanceAttribute,
  InstancedEntityMesh,
} from "./InstancedEntityMesh.ts";

const DEFAULT_DECAY_RATE = 1 / 0.15;

const ANIMATION_ATTRIBUTES: readonly InstanceAttribute[] = [
  // Multiplied with vertex color for non-player vertices
  { name: "instanceTint", itemSize: 3, fill: [1, 1, 1] },
  // [clipIndex, phase, speed, decayRate]
  { name: "instanceAnim", itemSize: 4, fill: [0, 0, 0, DEFAULT_DECAY_RATE] },
  // [clipIndex, phase, speed, weight] - blend target
  { name: "instanceAnimB", itemSize: 4, fill: [0, 0, 0, 0] },
];

export class AnimatedInstancedMesh extends InstancedEntityMesh {
  /** Animation data (textures, clip info) */
  readonly animationData: AnimationData | null;
  /** Camera definitions from the estb file */
  readonly cameras: ParsedCamera[];
  /** Scale factor used when building geometry */
  readonly modelScale: number;
  /** Depth pre-pass mesh for intra-instance occlusion of see-through instances */
  readonly depthMesh: InstancedMesh;
  /** Draws see-through instances and faded parts after every opaque sprite */
  readonly translucentMesh: InstancedMesh;
  private readonly hasAnimatedOpacity: boolean;
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
      /** Sorts instances by position; unsorted meshes draw in render order. */
      sort?: SpriteSort;
      translucentMaterial?: Material;
    },
  ) {
    super(geometry, material, count, {
      name: modelName,
      attributes: ANIMATION_ATTRIBUTES,
      sort: options?.sort,
    });
    staticInstances(this);

    this.hasAnimatedOpacity = Array.from(
      animationData?.opacityTexture.image.data ?? [],
    ).some((opacity) => opacity < 0.999);

    this.animationData = animationData ?? null;
    this.cameras = options?.cameras ?? [];
    this.modelScale = options?.modelScale ?? 1;

    this.depthMesh = staticInstances(
      new InstancedMesh(geometry, createDepthMaterial(), count),
    );
    this.depthMesh.renderOrder = 0;
    this.depthMesh.frustumCulled = false;
    this.depthMesh.onBeforeRender = (_r, _s, _c, _g, mat) => {
      for (const shaderRef of getShaderRefs(mat)) {
        this.updateAnimationUniforms(shaderRef);
      }
    };

    this.translucentMesh = staticInstances(
      new InstancedMesh(
        geometry,
        options?.translucentMaterial ?? material,
        count,
      ),
    );
    this.translucentMesh.frustumCulled = false;
    this.translucentMesh.raycast = () => {};
    this.translucentMesh.onBeforeRender = this.depthMesh.onBeforeRender;
    this.syncPassMeshes();

    this.onBeforeRender = this.depthMesh.onBeforeRender;

    onShaderReady(material, () => this.onShaderReady?.());
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

  protected syncPassMeshes() {
    for (const mesh of [this.depthMesh, this.translucentMesh]) {
      mesh.instanceMatrix = this.instanceMatrix;
      mesh.count = this.count;
    }
    this.depthMesh.visible = this.translucentInstances > 0;
    this.translucentMesh.visible =
      this.translucentMesh.material !== this.material &&
      (this.hasAnimatedOpacity || this.translucentInstances > 0);
  }

  setVertexColorAt(index: number | string, color: Color) {
    this.setTintAt(index, color);
  }

  /**
   * Set tint color for an instance.
   * Tint is multiplied with the base vertex color for non-player vertices.
   */
  setTintAt(index: number | string, color: Color) {
    const tintAttr = this.geometry.getAttribute("instanceTint");
    tintAttr.setXYZ(this.resolveIndex(index), color.r, color.g, color.b);
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
    index = this.resolveIndex(index);

    const clipIndex = typeof clip === "string"
      ? this.animationData?.clips.get(clip)?.index ?? 0
      : clip;

    const animAttr = this.geometry.getAttribute("instanceAnim");
    const animBAttr = this.geometry.getAttribute("instanceAnimB");

    if (crossfade) {
      const arr = animAttr.array;
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
    const animArr = this.geometry.getAttribute("instanceAnim").array;
    const animBAttr = this.geometry.getAttribute("instanceAnimB");
    const blendArr = animBAttr.array;
    let dirty = false;
    for (let i = 0; i < this.getCount(); i++) {
      const w = blendArr[i * 4 + 3];
      if (w > 0) {
        const rate = animArr[i * 4 + 3] * rateScale;
        blendArr[i * 4 + 3] = Math.max(0, w - delta * rate);
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
    index = this.resolveIndex(index);
    const tintAttr = this.geometry.getAttribute("instanceTint");
    return new Color(
      tintAttr.getX(index),
      tintAttr.getY(index),
      tintAttr.getZ(index),
    );
  }

  restoreInstanceColors(index: number | string, color: Color | null) {
    index = this.resolveIndex(index);
    if (color) this.setTintAt(index, color);
  }
}
