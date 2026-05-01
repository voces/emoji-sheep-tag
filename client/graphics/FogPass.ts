import {
  Color,
  DataTexture,
  DepthTexture,
  LinearFilter,
  Matrix4,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  RedFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";

import { getMaskShapeForBounds, type LoadedMap } from "@/shared/map.ts";

type MapDimensions = {
  width: number;
  height: number;
  bounds: LoadedMap["bounds"];
  mask: LoadedMap["mask"];
};

const buildMaskTexture = (
  mask: number[][] | undefined,
): { texture: DataTexture; width: number; height: number } => {
  // Pad with 1 ring of "always masked" cells: this represents the boundary
  // line itself as part of the mask, so the same Chebyshev-distance fade
  // handles both mask edges and the boundary in one mechanism (no separate
  // boundary fade needed). The padding ring sits one cell outside the
  // user-paintable grid; with bounds at half-integer coords (the editor
  // default), the inner edge of the padding ring lands exactly on the bounds
  // line, so a user-painted mask flush with the boundary forms a contiguous
  // dark region with the boundary itself.
  const rows = mask ?? [];
  const innerW = rows[0]?.length ?? 0;
  const innerH = rows.length;
  const width = innerW + 2;
  const height = innerH + 2;
  const data = new Uint8Array(width * height);
  // Top and bottom padding rows: all masked.
  for (let x = 0; x < width; x++) {
    data[x] = 255;
    data[(height - 1) * width + x] = 255;
  }
  for (let y = 0; y < innerH; y++) {
    const row = rows[y];
    const base = (y + 1) * width;
    // Left and right padding columns: always masked.
    data[base] = 255;
    data[base + width - 1] = 255;
    if (!row) continue;
    for (let x = 0; x < innerW; x++) {
      data[base + x + 1] = row[x] ? 255 : 0;
    }
  }
  const texture = new DataTexture(
    data,
    width,
    height,
    RedFormat,
    UnsignedByteType,
  );
  // Nearest filter: the shader uses 9-sample neighbor lookups to compute a
  // signed Chebyshev distance to the masked-region edge, which gives sharp
  // square edges (matching axis-aligned mask cells).
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.needsUpdate = true;
  return { texture, width, height };
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
    const maskTex = buildMaskTexture(mapDimensions.mask);
    const maskShape = getMaskShapeForBounds(mapDimensions.bounds);
    // Anchor points at the world center of texel (0, 0) — the top-left of the
    // padding ring. With 1 cell of padding, that's one cell outside the
    // user-paintable grid in each direction.
    const maskAnchor = new Vector4(
      maskShape.firstVertexX - 1,
      maskShape.topVertexY + 1,
      maskTex.width,
      maskTex.height,
    );
    const shader = {
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: depthTexture },
        fogTex: { value: fogTexture },
        prevFogTex: { value: this.previousFogTarget.texture },
        maskMap: { value: maskTex.texture },
        maskAnchor: { value: maskAnchor },
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
        nightAmount: { value: 0.0 },
        projInv: { value: new Matrix4() },
        viewInv: { value: new Matrix4() },
        deltaTime: { value: 0.016 },
        fogTexelSize: { value: new Vector2(1.0 / width, 1.0 / height) },
        disableFogOfWar: { value: false },
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
        uniform sampler2D maskMap;
        // x = firstVertexX (mask col 0 worldX), y = topVertexY (mask row 0
        // worldY), z = mask width (cells), w = mask height (cells). The
        // texture is always at least 1x1; an empty mask leaves that single
        // texel zero, so the mask check naturally falls through.
        uniform vec4 maskAnchor;
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
        uniform bool disableFogOfWar;
        uniform float nightAmount;

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

          // Apply fog only in hidden areas (unless fog of war is disabled)
          float alpha = disableFogOfWar ? 0.0 : fogOpacity * (1.0 - vis);

          // Manual mask + boundary edges. The mask texture has been padded
          // with one ring of "always masked" cells representing the bounds,
          // so this single 9-sample lookup handles both the user-painted
          // mask and the boundary fade in a unified way (no separate
          // boundary code). Coordinates: mapXf/mapYf are positions in the
          // padded cell grid (each cell = 1 world unit, axis-aligned).
          //
          // Signed Chebyshev distance to the union of masked cells:
          //   - If the current cell is masked, distance to nearest unmasked
          //     cardinal neighbor's near edge (negative = inside).
          //   - Otherwise, Chebyshev distance to the nearest masked
          //     neighbor's box (positive = outside, square corners).
          //
          // Clamp-to-edge sampling means fragments well outside the texture
          // sample only "padding" texels (all masked) and read as deep
          // inside the masked region — so out-of-bounds is fully dark
          // automatically.
          float mapXf = worldXY.x - maskAnchor.x + 0.5;
          float mapYf = maskAnchor.y - worldXY.y + 0.5;
          float fx = fract(mapXf);
          float fy = fract(mapYf);
          vec2 texelSize = vec2(1.0 / maskAnchor.z, 1.0 / maskAnchor.w);
          vec2 maskUV = vec2(mapXf * texelSize.x, mapYf * texelSize.y);
          float c  = texture2D(maskMap, maskUV).r;
          float rN = texture2D(maskMap, maskUV + vec2( texelSize.x, 0.0)).r;
          float lN = texture2D(maskMap, maskUV + vec2(-texelSize.x, 0.0)).r;
          float uN = texture2D(maskMap, maskUV + vec2(0.0, -texelSize.y)).r;
          float dN = texture2D(maskMap, maskUV + vec2(0.0,  texelSize.y)).r;
          float tl = texture2D(maskMap, maskUV + vec2(-texelSize.x, -texelSize.y)).r;
          float tr = texture2D(maskMap, maskUV + vec2( texelSize.x, -texelSize.y)).r;
          float bl = texture2D(maskMap, maskUV + vec2(-texelSize.x,  texelSize.y)).r;
          float br = texture2D(maskMap, maskUV + vec2( texelSize.x,  texelSize.y)).r;
          float maskEdgeDist;
          if (c > 0.5) {
            // Inside the masked region. Cardinals = perpendicular edge
            // distance; diagonals = Manhattan corner distance (overshoots
            // the geometric Euclidean value at 45°, intentionally — pushes
            // concave inside corners deeper into "fully dark" so they
            // don't look perceptibly lighter than the surrounding edges.
            // On cardinal axes the two metrics coincide, so straight
            // edges are unchanged.
            float dr = rN > 0.5 ? 1.0 : (1.0 - fx);
            float dl = lN > 0.5 ? 1.0 : fx;
            float du = uN > 0.5 ? 1.0 : fy;
            float dd = dN > 0.5 ? 1.0 : (1.0 - fy);
            float minDist = min(min(dr, dl), min(du, dd));
            if (tl < 0.5) minDist = min(minDist, fx + fy);
            if (tr < 0.5) minDist = min(minDist, (1.0 - fx) + fy);
            if (bl < 0.5) minDist = min(minDist, fx + (1.0 - fy));
            if (br < 0.5) minDist = min(minDist, (1.0 - fx) + (1.0 - fy));
            maskEdgeDist = -minDist;
          } else {
            // Outside the masked region. Cardinals = perpendicular edge
            // distance; diagonals = Manhattan corner distance (same
            // perceptual reason — pulls convex outer corners further from
            // the masked region so they don't read perceptibly darker
            // than the surrounding edges).
            float dr = rN > 0.5 ? (1.0 - fx) : 1.0;
            float dl = lN > 0.5 ? fx : 1.0;
            float du = uN > 0.5 ? fy : 1.0;
            float dd = dN > 0.5 ? (1.0 - fy) : 1.0;
            float minDist = min(min(dr, dl), min(du, dd));
            if (tl > 0.5) minDist = min(minDist, fx + fy);
            if (tr > 0.5) minDist = min(minDist, (1.0 - fx) + fy);
            if (bl > 0.5) minDist = min(minDist, fx + (1.0 - fy));
            if (br > 0.5) minDist = min(minDist, (1.0 - fx) + (1.0 - fy));
            maskEdgeDist = minDist;
          }

          float effectiveDistToEdge = min(distToEdge, maskEdgeDist);

          // Apply boundary/mask fade
          if (effectiveDistToEdge < fadeInset) {
            float fadeAmount = smoothstep(
              -fadeOutset,
              fadeInset,
              effectiveDistToEdge
            );
            alpha = mix(0.99, alpha, fadeAmount);
          }

          // If alpha is negligible, apply gamma and pass through
          if (alpha <= 0.0) {
            vec3 srgb = linearToSRGB(base.rgb);
            // Night tint: subtle blue shift and desaturation
            vec3 nightColor = mix(srgb, srgb * vec3(0.8, 0.82, 1.0), nightAmount);
            float lum = dot(srgb, vec3(0.299, 0.587, 0.114));
            nightColor = mix(nightColor, vec3(lum * 0.7, lum * 0.73, lum * 0.95), nightAmount * 0.15);
            gl_FragColor = vec4(nightColor, 1.0);
            return;
          }

          // Mix in linear space, then convert to sRGB for display
          vec3 outColor = mix(base.rgb, fogColor, alpha);
          vec3 srgb = linearToSRGB(outColor);
          // Night tint: desaturate and shift toward blue
          vec3 nightColor = mix(srgb, srgb * vec3(0.6, 0.65, 1.0), nightAmount);
          float lum = dot(srgb, vec3(0.299, 0.587, 0.114));
          nightColor = mix(nightColor, vec3(lum * 0.5, lum * 0.55, lum * 0.9), nightAmount * 0.4);
          gl_FragColor = vec4(nightColor, 1.0);
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

  setFogTexture(texture: DataTexture) {
    this.material.uniforms.fogTex.value = texture;
    this.smoothMaterial.uniforms.fogTex.value = texture;
  }

  /** Replace the manual mask layer (e.g. after editor edits or map updates). */
  setMask(mask: number[][], bounds: LoadedMap["bounds"]) {
    const next = buildMaskTexture(mask);
    const shape = getMaskShapeForBounds(bounds);
    const old = this.material.uniforms.maskMap.value as DataTexture | null;
    old?.dispose();
    this.material.uniforms.maskMap.value = next.texture;
    (this.material.uniforms.maskAnchor.value as Vector4).set(
      shape.firstVertexX - 1,
      shape.topVertexY + 1,
      next.width,
      next.height,
    );
  }

  setDisableFogOfWar(disable: boolean) {
    this.material.uniforms.disableFogOfWar.value = disable;
  }

  setNightAmount(amount: number) {
    this.material.uniforms.nightAmount.value = amount;
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

  compileAsync(renderer: WebGLRenderer) {
    return Promise.all([
      renderer.compileAsync(this.scene, this.camera),
      renderer.compileAsync(this.smoothScene, this.camera),
    ]);
  }

  dispose() {
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}
