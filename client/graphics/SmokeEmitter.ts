import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  PlaneGeometry,
  ShaderMaterial,
} from "three";
import { scene } from "./three.ts";

const INITIAL_CAPACITY = 64;
const GROWTH_FACTOR = 2;

const vertexShader = `
  attribute float birthTime;
  attribute vec2 startPos;
  attribute vec2 velocity;
  attribute float startScale;
  attribute float endScale;
  attribute float lifetime;
  attribute float grey;
  attribute float startAlpha;

  uniform float uTime;
  uniform float uWindSpeed;

  varying float vAlpha;
  varying float vGrey;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    float age = uTime - birthTime;
    float t = clamp(age / lifetime, 0.0, 1.0);

    if (age < 0.0 || age > lifetime) {
      gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
      vAlpha = 0.0;
      vGrey = 0.0;
      return;
    }

    float vy = velocity.y;
    float windFreqY = 2.0;
    float windFreqT = uWindSpeed;
    float a = vy * windFreqY + windFreqT;
    float b = startPos.y * windFreqY + birthTime * windFreqT;
    float windIntegral = 0.0;
    if (abs(a) > 0.001) {
      windIntegral = (-cos(a * age + b) + cos(b)) / a;
    } else {
      windIntegral = sin(b) * age;
    }
    float windX = windIntegral * 0.3;

    vec2 pos = startPos + velocity * age + vec2(windX, 0.0);
    float scale = mix(startScale, endScale, t);

    vec3 scaled = position * scale + vec3(pos, 0.1);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(scaled, 1.0);

    vAlpha = startAlpha * (1.0 - t);
    vGrey = grey;
  }
`;

const fragmentShader = `
  varying float vAlpha;
  varying float vGrey;
  varying vec2 vUv;

  void main() {
    float dist = length(vUv - vec2(0.5));
    if (dist > 0.5) discard;
    gl_FragColor = vec4(vec3(vGrey), vAlpha);
  }
`;

type Buffers = {
  birthTime: Float32Array;
  startPos: Float32Array;
  velocity: Float32Array;
  startScale: Float32Array;
  endScale: Float32Array;
  lifetime: Float32Array;
  grey: Float32Array;
  startAlpha: Float32Array;
};

const ATTR_SIZES: Record<keyof Buffers, number> = {
  birthTime: 1,
  startPos: 2,
  velocity: 2,
  startScale: 1,
  endScale: 1,
  lifetime: 1,
  grey: 1,
  startAlpha: 1,
};

const ATTR_KEYS = Object.keys(ATTR_SIZES) as (keyof Buffers)[];

const createBuffers = (capacity: number): Buffers => ({
  birthTime: new Float32Array(capacity),
  startPos: new Float32Array(capacity * 2),
  velocity: new Float32Array(capacity * 2),
  startScale: new Float32Array(capacity),
  endScale: new Float32Array(capacity),
  lifetime: new Float32Array(capacity),
  grey: new Float32Array(capacity),
  startAlpha: new Float32Array(capacity),
});

export class SmokeEmitter {
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
        uWindSpeed: { value: 0.3 },
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

  emit({ time, x, y, vx, vy, startScale, endScale, lifetime, grey, alpha }: {
    time: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    startScale: number;
    endScale: number;
    lifetime: number;
    grey: number;
    alpha: number;
  }) {
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
    this.buf.startScale[i] = startScale;
    this.buf.endScale[i] = endScale;
    this.buf.lifetime[i] = lifetime;
    this.buf.grey[i] = grey / 255;
    this.buf.startAlpha[i] = alpha;

    for (const key of ATTR_KEYS) this.attrs[key].needsUpdate = true;

    this.cursor = (this.cursor + 1) % this.capacity;
  }

  update(time: number) {
    this.material.uniforms.uTime.value = time;
  }
}
