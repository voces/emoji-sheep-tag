import {
  DepthTexture,
  type PerspectiveCamera,
  type Scene,
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

  // The fog pass draws straight into the corner of the main canvas that is
  // copied out to the minimap
  const createMinimapFogPass = () => {
    const map = getMap();
    const pass = new FogPass(
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
    pass.renderToScreen = true;
    return pass;
  };

  let minimapFogPass = createMinimapFogPass();
  let fogDisabled = false;

  const unsubscribeFog = onMapChange(() => {
    minimapFogPass.dispose();
    minimapFogPass = createMinimapFogPass();
    minimapFogPass.setDisableFogOfWar(fogDisabled);
  });

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

  // The minimap has no renderer of its own: it borrows the main one, draws its
  // fogged scene into the corner of its drawing buffer and copies that out to
  // its own 2D canvas
  const renderFogAndOverlay = (
    delta: number,
    ctx: CanvasRenderingContext2D,
  ) => {
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

    // Sync fog texture in case visibilityGrid was recreated
    minimapFogPass.setFogTexture(visibilityGrid.fogTexture);
    minimapFogPass.updateCamera(camera);

    renderInCorner(
      renderer,
      ctx,
      { width: target.width * scale, height: target.height * scale },
      () =>
        minimapFogPass.render(
          renderer,
          sceneRenderTarget,
          sceneRenderTarget,
          delta,
        ),
    );
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
      minimapFogPass.dispose();
    },
  };
};
