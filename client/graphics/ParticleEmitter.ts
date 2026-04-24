import {
  CanvasTexture,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  NearestFilter,
  PlaneGeometry,
  ShaderMaterial,
  type Texture,
} from "three";
import { scene } from "./three.ts";
import { WIND_SHADER_INTEGRAL_FN } from "./windShader.ts";

const INITIAL_CAPACITY = 64;
const GROWTH_FACTOR = 2;

// Attributes are packed to stay under the 16-slot WebGL limit:
//   position(1) + uv(1) + instanceMatrix(4) = 6 built-in
//   birthTime(1) + startPos(1) + velocity(1) + scalePack(1) +
//   lifetime(1) + appearance(1) + physicsPack(1) = 7 custom
//   Total: 13 slots (safe headroom).
//
// scalePack   = vec2(startScale, endScale)
// appearance  = vec2(grey, startAlpha)
// physicsPack = vec2(gravity, rotation)

const vertexShader = `
  attribute float birthTime;
  attribute vec2 startPos;
  attribute vec2 velocity;
  attribute vec2 scalePack;
  attribute float lifetime;
  attribute vec4 appearance;
  attribute vec2 physicsPack;

  uniform float uTime;

  ${WIND_SHADER_INTEGRAL_FN}

  varying float vAlpha;
  varying vec3 vColor;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    float age = uTime - birthTime;
    float t = clamp(age / lifetime, 0.0, 1.0);

    if (age < 0.0 || age > lifetime) {
      gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
      vAlpha = 0.0;
      vColor = vec3(0.0);
      return;
    }

    float startScale = scalePack.x;
    float endScale = scalePack.y;
    vec3 color = appearance.rgb;
    float startAlpha = appearance.a;
    float gravity = physicsPack.x;
    float rotation = physicsPack.y;

    float windX = windIntegral(startPos.y, velocity.y, birthTime, age);

    vec2 pos = startPos + velocity * age + vec2(windX, -0.5 * gravity * age * age);
    float scale = mix(startScale, endScale, t);

    // Rotate to face the instantaneous velocity direction so drops
    // turn as gravity pulls them downward. The per-particle rotation
    // attribute acts as a fixed offset (e.g. PI/2 to align the SVG).
    // Instantaneous velocity including gravity. At the arc apex (near
    // zero velocity) fall back to pointing in the gravity direction
    // (-Y) so the drop doesn't snap sideways.
    vec2 currentVel = velocity + vec2(0.0, -gravity * age);
    float velAngle = length(currentVel) > 0.01
      ? atan(currentVel.y, currentVel.x)
      : (gravity > 0.0 ? -1.5708 : 0.0);
    float totalRotation = velAngle + rotation;
    float c = cos(totalRotation);
    float s = sin(totalRotation);
    vec3 rotated = vec3(
      position.x * c - position.y * s,
      position.x * s + position.y * c,
      position.z
    );

    vec3 scaled = rotated * scale + vec3(pos, 0.1);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(scaled, 1.0);

    vAlpha = startAlpha * (1.0 - t);
    vColor = color;
  }
`;

const fragmentShader = `
  uniform sampler2D uMap;
  uniform float uHasMap;

  varying float vAlpha;
  varying vec3 vColor;
  varying vec2 vUv;

  void main() {
    if (uHasMap > 0.5) {
      float alpha = texture2D(uMap, vUv).a;
      if (alpha < 0.1) discard;
      gl_FragColor = vec4(vColor, alpha * vAlpha);
    } else {
      float dist = length(vUv - vec2(0.5));
      if (dist > 0.5) discard;
      gl_FragColor = vec4(vColor, vAlpha);
    }
  }
`;

type Buffers = {
  birthTime: Float32Array;
  startPos: Float32Array;
  velocity: Float32Array;
  scalePack: Float32Array;
  lifetime: Float32Array;
  appearance: Float32Array;
  physicsPack: Float32Array;
};

const ATTR_SIZES: Record<keyof Buffers, number> = {
  birthTime: 1,
  startPos: 2,
  velocity: 2,
  scalePack: 2,
  lifetime: 1,
  appearance: 4,
  physicsPack: 2,
};

const ATTR_KEYS = Object.keys(ATTR_SIZES) as (keyof Buffers)[];

const createBuffers = (capacity: number): Buffers => ({
  birthTime: new Float32Array(capacity),
  startPos: new Float32Array(capacity * 2),
  velocity: new Float32Array(capacity * 2),
  scalePack: new Float32Array(capacity * 2),
  lifetime: new Float32Array(capacity),
  appearance: new Float32Array(capacity * 4),
  physicsPack: new Float32Array(capacity * 2),
});

/**
 * Rasterizes an SVG string into a Texture. Only the alpha channel is
 * used by the particle shader (the color comes from the per-particle
 * `grey` attribute), so the SVG's fill color doesn't matter.
 */
export const svgToTexture = (
  svgContent: string,
  size = 64,
): Promise<Texture> =>
  new Promise((resolve) => {
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      const tex = new CanvasTexture(canvas);
      tex.minFilter = NearestFilter;
      tex.magFilter = NearestFilter;
      resolve(tex);
    };
    img.src = url;
  });

export class ParticleEmitter {
  private mesh: InstancedMesh;
  private material: ShaderMaterial;
  private attrs: Record<keyof Buffers, InstancedBufferAttribute>;
  private buf: Buffers;
  private capacity: number;
  private cursor = 0;
  private geo: PlaneGeometry;

  constructor() {
    this.capacity = INITIAL_CAPACITY;
    this.geo = new PlaneGeometry(1, 1);
    this.buf = createBuffers(this.capacity);
    this.buf.birthTime.fill(-9999);
    this.attrs = this.buildAttrs();

    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uMap: { value: null },
        uHasMap: { value: 0 },
      },
    });

    this.mesh = this.buildMesh();
  }

  private buildAttrs() {
    const attrs = {} as Record<keyof Buffers, InstancedBufferAttribute>;
    for (const key of ATTR_KEYS) {
      const attr = new InstancedBufferAttribute(this.buf[key], ATTR_SIZES[key]);
      attr.setUsage(DynamicDrawUsage);
      this.geo.setAttribute(key, attr);
      attrs[key] = attr;
    }
    return attrs;
  }

  private buildMesh() {
    const mesh = new InstancedMesh(this.geo, this.material, this.capacity);
    mesh.frustumCulled = false;
    mesh.renderOrder = 999;
    scene.add(mesh);
    return mesh;
  }

  private grow() {
    const newCapacity = this.capacity * GROWTH_FACTOR;
    const newBuf = createBuffers(newCapacity);

    for (const key of ATTR_KEYS) {
      newBuf[key].set(this.buf[key]);
    }
    newBuf.birthTime.fill(-9999, this.capacity);

    this.buf = newBuf;

    const oldMatrix = this.mesh.instanceMatrix.array;
    this.mesh.removeFromParent();
    this.mesh.dispose();

    this.attrs = this.buildAttrs();
    this.capacity = newCapacity;
    this.mesh = this.buildMesh();

    (this.mesh.instanceMatrix.array as Float32Array).set(oldMatrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  setTexture(texture: Texture) {
    this.material.uniforms.uMap.value = texture;
    this.material.uniforms.uHasMap.value = 1;
  }

  emit(
    {
      time,
      x,
      y,
      vx,
      vy,
      startScale,
      endScale,
      lifetime,
      color,
      alpha,
      gravity = 0,
      rotation = 0,
    }: {
      time: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
      startScale: number;
      endScale: number;
      lifetime: number;
      /** RGB color [r, g, b] each 0-1. */
      color: [number, number, number];
      alpha: number;
      gravity?: number;
      rotation?: number;
    },
  ) {
    if (
      this.buf.birthTime[this.cursor] +
          this.buf.lifetime[this.cursor] > time
    ) {
      const oldCapacity = this.capacity;
      this.grow();
      this.cursor = oldCapacity;
    }

    const i = this.cursor;
    this.buf.birthTime[i] = time;
    this.buf.startPos[i * 2] = x;
    this.buf.startPos[i * 2 + 1] = y;
    this.buf.velocity[i * 2] = vx;
    this.buf.velocity[i * 2 + 1] = vy;
    this.buf.scalePack[i * 2] = startScale;
    this.buf.scalePack[i * 2 + 1] = endScale;
    this.buf.lifetime[i] = lifetime;
    this.buf.appearance[i * 4] = color[0];
    this.buf.appearance[i * 4 + 1] = color[1];
    this.buf.appearance[i * 4 + 2] = color[2];
    this.buf.appearance[i * 4 + 3] = alpha;
    this.buf.physicsPack[i * 2] = gravity;
    this.buf.physicsPack[i * 2 + 1] = rotation;

    for (const key of ATTR_KEYS) this.attrs[key].needsUpdate = true;

    this.cursor = (this.cursor + 1) % this.capacity;
  }

  update(time: number) {
    this.material.uniforms.uTime.value = time;
  }
}
