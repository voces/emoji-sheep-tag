import {
  Color,
  DataTexture,
  DepthTexture,
  LinearFilter,
  Matrix4,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  RedFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";

import type { LoadedMap } from "@/shared/map.ts";

type MapDimensions = {
  width: number;
  height: number;
  bounds: LoadedMap["bounds"];
};

export class FogPass {
  private scene: Scene;
  private camera: OrthographicCamera;
  private quad: Mesh;
  private material: ShaderMaterial;
  private smoothScene: Scene;
  private smoothQuad: Mesh;
  private smoothMaterial: ShaderMaterial;
  private previousFogTarget: WebGLRenderTarget;
  private currentFogTarget: WebGLRenderTarget;
  renderToScreen = false;
  clear = false;

  constructor(
    fogTexture: DataTexture,
    depthTexture: DepthTexture,
    camera: PerspectiveCamera,
    mapDimensions: MapDimensions,
  ) {
    // Create render targets for ping-pong fog smoothing
    const width = fogTexture.image.width;
    const height = fogTexture.image.height;

    this.previousFogTarget = new WebGLRenderTarget(width, height, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      format: RedFormat,
    });

    this.currentFogTarget = new WebGLRenderTarget(width, height, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      format: RedFormat,
    });
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: depthTexture },
        fogTex: { value: fogTexture },
        prevFogTex: { value: this.previousFogTarget.texture },
        cameraNear: { value: camera.near },
        cameraFar: { value: camera.far },
        worldMin: { value: new Vector2(0, 0) },
        worldMax: {
          value: new Vector2(mapDimensions.width, mapDimensions.height),
        },
        boundsMin: {
          value: new Vector2(
            mapDimensions.bounds.min.x,
            mapDimensions.bounds.min.y,
          ),
        },
        boundsMax: {
          value: new Vector2(
            mapDimensions.bounds.max.x,
            mapDimensions.bounds.max.y,
          ),
        },
        fogColor: { value: new Color(0x000000) },
        fogOpacity: { value: 0.95 },
        projInv: { value: new Matrix4() },
        viewInv: { value: new Matrix4() },
        deltaTime: { value: 0.016 },
        fogTexelSize: { value: new Vector2(1.0 / width, 1.0 / height) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        #include <packing>
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform sampler2D fogTex;
        uniform sampler2D prevFogTex;
        uniform vec3 fogColor;
        uniform float fogOpacity;
        uniform float cameraNear;
        uniform float cameraFar;
        uniform vec2 worldMin;
        uniform vec2 worldMax;
        uniform vec2 boundsMin;
        uniform vec2 boundsMax;
        uniform mat4 projInv;
        uniform mat4 viewInv;
        uniform float deltaTime;
        uniform vec2 fogTexelSize;

        varying vec2 vUv;

        // sRGB conversion functions
        vec3 linearToSRGB(vec3 linear) {
          return mix(
            linear * 12.92,
            pow(linear, vec3(1.0 / 2.4)) * 1.055 - 0.055,
            step(0.0031308, linear)
          );
        }

        vec3 sRGBToLinear(vec3 srgb) {
          return mix(
            srgb / 12.92,
            pow((srgb + 0.055) / 1.055, vec3(2.4)),
            step(0.04045, srgb)
          );
        }

        vec2 screenToWorld(vec2 screenUV) {
          // Convert screen UV to NDC
          vec2 ndc = screenUV * 2.0 - 1.0;

          // Unproject to view space at near plane
          vec4 nearPoint = projInv * vec4(ndc, -1.0, 1.0);
          nearPoint /= nearPoint.w;

          // Unproject to view space at far plane
          vec4 farPoint = projInv * vec4(ndc, 1.0, 1.0);
          farPoint /= farPoint.w;

          // Transform to world space
          vec3 nearWorld = (viewInv * nearPoint).xyz;
          vec3 farWorld = (viewInv * farPoint).xyz;

          // Find intersection with z=0 plane (the game plane)
          float t = -nearWorld.z / (farWorld.z - nearWorld.z);
          vec3 worldPos = nearWorld + t * (farWorld - nearWorld);

          return worldPos.xy;
        }

        void main() {
          vec4 base = texture2D(tDiffuse, vUv);

          // Get world XY coordinates directly from screen position
          vec2 worldXY = screenToWorld(vUv);

          // Calculate distance to nearest boundary edge
          float fadeInset = 0.25; // Fade starts this far inside bounds
          float fadeOutset = 0.125; // Fade extends this far outside bounds
          float distToEdge = min(
            min(worldXY.x - boundsMin.x, boundsMax.x - worldXY.x),
            min(worldXY.y - boundsMin.y, boundsMax.y - worldXY.y)
          );

          // Map world XY to fog UV
          vec2 fogUV;
          fogUV.x = (worldXY.x - worldMin.x) / (worldMax.x - worldMin.x);
          fogUV.y = (worldXY.y - worldMin.y) / (worldMax.y - worldMin.y);
          fogUV = clamp(fogUV, 0.0, 1.0);

          // Sample smoothed visibility from previous fog target
          float vis = texture2D(prevFogTex, fogUV).r;

          // Apply fog only in hidden areas
          float alpha = fogOpacity * (1.0 - vis);

          // Apply boundary fade if near or outside bounds
          if (distToEdge < fadeInset) {
            // Calculate fade: -fadeOutset (outside) to +fadeInset (inside)
            float fadeAmount = smoothstep(-fadeOutset, fadeInset, distToEdge);
            // Mix from deeper fog (0.99) outside to normal alpha inside
            alpha = mix(0.99, alpha, fadeAmount);
          }

          // If alpha is negligible, apply gamma and pass through
          if (alpha <= 0.0) {
            gl_FragColor = vec4(linearToSRGB(base.rgb), 1.0);
            return;
          }

          // Mix in linear space, then convert to sRGB for display
          vec3 outColor = mix(base.rgb, fogColor, alpha);
          gl_FragColor = vec4(linearToSRGB(outColor), 1.0);
        }
      `,
    };

    this.material = new ShaderMaterial({
      uniforms: shader.uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });

    // Create smooth fog shader (outputs smoothed vis value only)
    const smoothShader = {
      uniforms: {
        fogTex: { value: fogTexture },
        prevFogTex: { value: this.previousFogTarget.texture },
        deltaTime: { value: 0.016 },
        fogTexelSize: { value: new Vector2(1.0 / width, 1.0 / height) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D fogTex;
        uniform sampler2D prevFogTex;
        uniform float deltaTime;
        uniform vec2 fogTexelSize;
        varying vec2 vUv;

        void main() {
          float targetVis = texture2D(fogTex, vUv).r;
          float prevVis = texture2D(prevFogTex, vUv).r;

          // Always blur the target for smooth edges (7x7 kernel, wider spread)
          float targetSum = 0.0;
          float targetWeightSum = 0.0;

          for (int dy = -3; dy <= 3; dy++) {
            for (int dx = -3; dx <= 3; dx++) {
              vec2 offset = vec2(float(dx), float(dy)) * fogTexelSize;
              vec2 sampleUV = vUv + offset;
              float neighborVis = texture2D(fogTex, sampleUV).r;
              float dist = length(vec2(float(dx), float(dy)));
              float weight = exp(-dist * dist / 6.0);
              targetSum += neighborVis * weight;
              targetWeightSum += weight;
            }
          }

          float targetBlurred = targetWeightSum > 0.0 ? targetSum / targetWeightSum : targetVis;

          // Temporal smoothing: faster reveal, slower hide
          float interpolationSpeed = targetBlurred > prevVis ? 3.0 : 1.5;
          float vis = prevVis + (targetBlurred - prevVis) * min(deltaTime * interpolationSpeed, 1.0);

          // Keep minimum visibility for previously FULLY seen areas (black mask effect)
          // Only apply if the area was actually revealed (>0.8), not just barely visible
          float minVisibility = 0.15;
          if (prevVis > 0.8) {
            vis = max(vis, minVisibility);
          }

          gl_FragColor = vec4(vis, vis, vis, 1.0);
        }
      `,
    };

    this.smoothMaterial = new ShaderMaterial({
      uniforms: smoothShader.uniforms,
      vertexShader: smoothShader.vertexShader,
      fragmentShader: smoothShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });

    // Create full-screen quads
    const geometry = new PlaneGeometry(2, 2);
    this.quad = new Mesh(geometry, this.material);
    this.scene = new Scene();
    this.scene.add(this.quad);

    this.smoothQuad = new Mesh(geometry.clone(), this.smoothMaterial);
    this.smoothScene = new Scene();
    this.smoothScene.add(this.smoothQuad);

    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
    deltaTime?: number,
  ) {
    // Update delta time
    if (deltaTime !== undefined) {
      this.smoothMaterial.uniforms.deltaTime.value = deltaTime;
    }

    // First pass: Render smoothed fog to currentFogTarget
    renderer.setRenderTarget(this.currentFogTarget);
    renderer.clear();
    renderer.render(this.smoothScene, this.camera);

    // Second pass: Render final scene with fog
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    this.material.uniforms.prevFogTex.value = this.currentFogTarget.texture;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      renderer.render(this.scene, this.camera);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      renderer.render(this.scene, this.camera);
    }

    // Swap targets for next frame
    const temp = this.previousFogTarget;
    this.previousFogTarget = this.currentFogTarget;
    this.currentFogTarget = temp;
    this.smoothMaterial.uniforms.prevFogTex.value =
      this.previousFogTarget.texture;
  }

  updateCamera(camera: PerspectiveCamera) {
    this.material.uniforms.cameraNear.value = camera.near;
    this.material.uniforms.cameraFar.value = camera.far;
    this.material.uniforms.projInv.value.copy(camera.projectionMatrix).invert();
    this.material.uniforms.viewInv.value.copy(camera.matrixWorld);
  }

  reset(renderer: WebGLRenderer) {
    // Clear previous fog targets to reset the black mask effect
    // We need to render black (0,0,0,1) to these targets
    const oldTarget = renderer.getRenderTarget();
    const oldClearColor = renderer.getClearColor(new Color());
    const oldClearAlpha = renderer.getClearAlpha();

    // Set clear color to black
    renderer.setClearColor(0x000000, 1.0);

    renderer.setRenderTarget(this.previousFogTarget);
    renderer.clear();

    renderer.setRenderTarget(this.currentFogTarget);
    renderer.clear();

    // Restore previous clear color
    renderer.setClearColor(oldClearColor, oldClearAlpha);
    renderer.setRenderTarget(oldTarget);
  }

  dispose() {
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}
