import {
  BufferGeometry,
  DepthTexture,
  Line,
  LineBasicMaterial,
  Mesh,
  OrthographicCamera,
  type PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedInt248Type,
  Vector3,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { getMap, onMapChange } from "@/shared/map.ts";
import { visibilityGrid } from "../../../systems/fog.ts";
import { FogPass } from "../../../graphics/FogPass.ts";
import { type Entity } from "../../../ecs.ts";
import { setMinimapMask } from "../../../systems/three.ts";

export const createMinimapRenderer = (
  renderer: WebGLRenderer,
  camera: PerspectiveCamera,
  scene: Scene,
  minimapUnits: Set<Entity>,
  minimapPlayerEntities: Set<Entity>,
  pixelRatio: number,
) => {
  const renderWidth = 262 * pixelRatio;
  const renderHeight = 262 * pixelRatio;

  const sceneRenderTarget = new WebGLRenderTarget(renderWidth, renderHeight, {
    depthBuffer: true,
    depthTexture: new DepthTexture(
      renderWidth,
      renderHeight,
      UnsignedInt248Type,
    ),
    samples: 4,
  });

  const fogOutputTarget = new WebGLRenderTarget(renderWidth, renderHeight);

  const createMinimapFogPass = () => {
    const map = getMap();
    return new FogPass(
      visibilityGrid.fogTexture,
      sceneRenderTarget.depthTexture!,
      camera,
      { width: map.width, height: map.height, bounds: map.bounds },
    );
  };

  let minimapFogPass = createMinimapFogPass();

  const unsubscribeFog = onMapChange(() => {
    minimapFogPass.dispose();
    minimapFogPass = createMinimapFogPass();
  });

  const blitScene = new Scene();
  const blitCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blitMaterial = new ShaderMaterial({
    uniforms: {
      tDiffuse: { value: fogOutputTarget.texture },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(tDiffuse, vUv);
      }
    `,
  });
  const blitQuad = new Mesh(new PlaneGeometry(2, 2), blitMaterial);
  blitScene.add(blitQuad);

  const viewportIndicatorScene = new Scene();
  const viewportIndicator = new Line(
    new BufferGeometry(),
    new LineBasicMaterial({ color: 0xffffff, linewidth: 2 }),
  );
  viewportIndicatorScene.add(viewportIndicator);

  const renderScene = () => {
    const scaledEntities: Array<{ entity: Entity; originalScale: number }> = [];
    const maskedEntities: Entity[] = [];

    for (const entity of minimapUnits) {
      const originalScale = entity.modelScale ?? 1;
      scaledEntities.push({ entity, originalScale });
      entity.modelScale = originalScale * 5;
    }

    for (const entity of minimapPlayerEntities) {
      setMinimapMask(entity, true);
      maskedEntities.push(entity);
    }

    renderer.setRenderTarget(sceneRenderTarget);
    renderer.clear();
    renderer.render(scene, camera);

    for (const { entity, originalScale } of scaledEntities) {
      entity.modelScale = originalScale;
    }

    for (const entity of maskedEntities) setMinimapMask(entity, false);
  };

  const renderFogAndOverlay = (
    delta: number,
    mainCamera: PerspectiveCamera,
  ) => {
    minimapFogPass.updateCamera(camera);

    const aspect = mainCamera.aspect;
    const vFov = (mainCamera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFov / 2) * mainCamera.position.z;
    const width = height * aspect;

    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const x = mainCamera.position.x;
    const y = mainCamera.position.y;

    const points = [
      new Vector3(x - halfWidth, y - halfHeight, 0),
      new Vector3(x + halfWidth, y - halfHeight, 0),
      new Vector3(x + halfWidth, y + halfHeight, 0),
      new Vector3(x - halfWidth, y + halfHeight, 0),
      new Vector3(x - halfWidth, y - halfHeight, 0),
    ];

    viewportIndicator.geometry.setFromPoints(points);

    minimapFogPass.render(
      renderer,
      fogOutputTarget,
      sceneRenderTarget,
      delta,
    );

    renderer.setRenderTarget(fogOutputTarget);
    renderer.autoClear = false;
    renderer.render(viewportIndicatorScene, camera);
    renderer.autoClear = true;

    blitMaterial.uniforms.tDiffuse.value = fogOutputTarget.texture;
    renderer.setRenderTarget(null);
    renderer.render(blitScene, blitCamera);
  };

  return {
    renderScene,
    renderFogAndOverlay,
    dispose: () => {
      unsubscribeFog();
      sceneRenderTarget.dispose();
      fogOutputTarget.dispose();
      minimapFogPass.dispose();
      blitMaterial.dispose();
      blitQuad.geometry.dispose();
      viewportIndicator.geometry.dispose();
    },
  };
};
