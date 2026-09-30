import {
  DepthTexture,
  Mesh,
  OrthographicCamera,
  type PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedInt248Type,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { getMap, onMapChange } from "@/shared/map.ts";
import { visibilityGrid } from "../../../systems/fog.ts";
import { FogPass } from "../../../graphics/FogPass.ts";
import { type Entity } from "../../../ecs.ts";
import { setMinimapMask } from "../../../systems/three.ts";
import { terrain } from "../../../graphics/three.ts";
import {
  renderInCorner,
  withRendererState,
} from "../../../graphics/rendererState.ts";

const BACKGROUND_COLOR = 0x333333;

export const createMinimapRenderer = (
  renderer: WebGLRenderer,
  camera: PerspectiveCamera,
  scene: Scene,
  minimapUnits: Set<Entity>,
  minimapPlayerEntities: Set<Entity>,
  pixelRatio: number,
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
    withRendererState(renderer, () => {
      renderer.setClearColor(BACKGROUND_COLOR, 1);
      renderer.setRenderTarget(sceneRenderTarget);
      renderer.clear();
      renderer.render(scene, camera);
    });
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
  // into the corner of its drawing buffer and copies that out to its own 2D
  // canvas
  const present = (ctx: CanvasRenderingContext2D) => {
    const source = renderer.domElement;
    const target = ctx.canvas;
    if (!target.width || !target.height || !source.width || !source.height) {
      return;
    }
    const scale = Math.min(
      1,
      source.width / target.width,
      source.height / target.height,
    );
    renderInCorner(
      renderer,
      ctx,
      { width: target.width * scale, height: target.height * scale },
      () => renderer.render(blitScene, blitCamera),
    );
  };

  const renderFogAndOverlay = (
    delta: number,
    ctx: CanvasRenderingContext2D,
  ) => {
    // Sync fog texture in case visibilityGrid was recreated
    minimapFogPass.setFogTexture(visibilityGrid.fogTexture);
    minimapFogPass.updateCamera(camera);

    minimapFogPass.render(
      renderer,
      fogOutputTarget,
      sceneRenderTarget,
      delta,
    );

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
    },
  };
};
