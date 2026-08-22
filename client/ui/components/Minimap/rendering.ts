import {
  BufferGeometry,
  Color,
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
  Vector4,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { getMap, onMapChange } from "@/shared/map.ts";
import { visibilityGrid } from "../../../systems/fog.ts";
import { FogPass } from "../../../graphics/FogPass.ts";
import { type Entity } from "../../../ecs.ts";
import { setMinimapMask } from "../../../systems/three.ts";
import { terrain } from "../../../graphics/three.ts";

const BACKGROUND_COLOR = 0x333333;

const previousClearColor = new Color();
const previousViewport = new Vector4();
const previousScissor = new Vector4();

export const createMinimapRenderer = (
  renderer: WebGLRenderer,
  camera: PerspectiveCamera,
  scene: Scene,
  minimapUnits: Set<Entity>,
  minimapPlayerEntities: Set<Entity>,
  pixelRatio: number,
  showCameraBox = true,
) => {
  const renderWidth = 260 * pixelRatio;
  const renderHeight = 260 * pixelRatio;

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
      {
        width: map.width,
        height: map.height,
        bounds: map.bounds,
        mask: map.mask,
      },
    );
  };

  let minimapFogPass = createMinimapFogPass();
  let fogDisabled = false;

  const unsubscribeFog = onMapChange(() => {
    minimapFogPass.dispose();
    minimapFogPass = createMinimapFogPass();
    minimapFogPass.setDisableFogOfWar(fogDisabled);
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
    const boostedAlphaEntities: Array<
      { entity: Entity; originalAlpha: number }
    > = [];
    const maskedEntities: Entity[] = [];

    for (const entity of minimapUnits) {
      const originalScale = entity.modelScale ?? 1;
      scaledEntities.push({ entity, originalScale });
      entity.modelScale = originalScale * 5;
    }

    for (const entity of minimapPlayerEntities) {
      setMinimapMask(entity, true);
      maskedEntities.push(entity);
      if (entity.alpha && entity.alpha < 1) {
        const originalAlpha = entity.alpha;
        boostedAlphaEntities.push({ entity, originalAlpha });
        entity.alpha = Math.min(1, originalAlpha * 4);
      }
    }

    terrain.setDecalsEnabled(false);
    const previousTarget = renderer.getRenderTarget();
    renderer.getClearColor(previousClearColor);
    const previousClearAlpha = renderer.getClearAlpha();
    renderer.setClearColor(BACKGROUND_COLOR, 1);
    renderer.setRenderTarget(sceneRenderTarget);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setClearColor(previousClearColor, previousClearAlpha);
    renderer.setRenderTarget(previousTarget);
    terrain.setDecalsEnabled(true);

    for (const { entity, originalScale } of scaledEntities) {
      entity.modelScale = originalScale;
    }

    for (const { entity, originalAlpha } of boostedAlphaEntities) {
      entity.alpha = originalAlpha;
    }

    for (const entity of maskedEntities) setMinimapMask(entity, false);
  };

  // The minimap has no renderer of its own: it borrows the main one, composites
  // into the bottom-left corner of its drawing buffer and copies that rect out
  // to its own 2D canvas. The copy is valid because this runs inside the main
  // render loop, before the frame is presented — and the game render that
  // follows overwrites the corner again.
  const present = (ctx: CanvasRenderingContext2D) => {
    const source = renderer.domElement;
    const target = ctx.canvas;
    if (!target.width || !target.height || !source.width || !source.height) {
      return;
    }

    const ratio = renderer.getPixelRatio();
    const scale = Math.min(
      1,
      source.width / target.width,
      source.height / target.height,
    );
    const width = target.width * scale;
    const height = target.height * scale;

    renderer.getViewport(previousViewport);
    renderer.getScissor(previousScissor);
    const previousScissorTest = renderer.getScissorTest();
    const previousTarget = renderer.getRenderTarget();

    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, width / ratio, height / ratio);
    renderer.setScissor(0, 0, width / ratio, height / ratio);
    renderer.setScissorTest(true);
    renderer.render(blitScene, blitCamera);

    ctx.drawImage(
      source,
      0,
      source.height - Math.round(height),
      Math.round(width),
      Math.round(height),
      0,
      0,
      target.width,
      target.height,
    );

    renderer.setRenderTarget(previousTarget);
    renderer.setViewport(previousViewport);
    renderer.setScissor(previousScissor);
    renderer.setScissorTest(previousScissorTest);
  };

  const renderFogAndOverlay = (
    delta: number,
    mainCamera: PerspectiveCamera,
    ctx: CanvasRenderingContext2D,
  ) => {
    // Sync fog texture in case visibilityGrid was recreated
    minimapFogPass.setFogTexture(visibilityGrid.fogTexture);
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

    minimapFogPass.render(
      renderer,
      fogOutputTarget,
      sceneRenderTarget,
      delta,
    );

    if (showCameraBox) {
      viewportIndicator.geometry.setFromPoints(points);
      renderer.setRenderTarget(fogOutputTarget);
      renderer.autoClear = false;
      renderer.render(viewportIndicatorScene, camera);
      renderer.autoClear = true;
    }

    blitMaterial.uniforms.tDiffuse.value = fogOutputTarget.texture;
    present(ctx);
  };

  return {
    renderScene,
    renderFogAndOverlay,
    setDisableFogOfWar: (disable: boolean) => {
      fogDisabled = disable;
      minimapFogPass.setDisableFogOfWar(disable);
    },
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
