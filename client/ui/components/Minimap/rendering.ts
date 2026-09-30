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
import { collections } from "../../../systems/models.ts";
import { terrain } from "../../../graphics/three.ts";
import {
  type CornerContext,
  type CornerRenderer,
  renderInCorner,
  withRendererState,
} from "../../../graphics/rendererState.ts";

const BACKGROUND_COLOR = 0x333333;
const UNIT_SCALE = 5;
const FADED_ALPHA_BOOST = 4;

const collectionOf = (entity: Entity) =>
  collections[entity.model ?? entity.prefab ?? ""];

const isFaded = (entity: Entity): entity is Entity & { alpha: number } =>
  !!entity.alpha && entity.alpha < 1;

type MinimapRenderer<Source extends { width: number; height: number }> =
  & CornerRenderer<Source>
  & Pick<WebGLRenderer, "clear" | "render">;

export const createMinimapRenderer = <
  Source extends { width: number; height: number },
>(
  renderer: MinimapRenderer<Source>,
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

  // Units drawn larger and faded entities more solid so they read at minimap
  // size. Set on their instances directly and put back after, never on the
  // entities, so no system or UI sees the change
  const renderScene = () => {
    for (const entity of minimapUnits) {
      collectionOf(entity)?.setScaleAt(
        entity.id,
        (entity.modelScale ?? 1) * UNIT_SCALE,
        entity.aspectRatio,
      );
    }
    for (const entity of minimapPlayerEntities) {
      setMinimapMask(entity, true);
      if (isFaded(entity)) {
        collectionOf(entity)?.setAlphaAt(
          entity.id,
          Math.min(1, entity.alpha * FADED_ALPHA_BOOST),
        );
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

    for (const entity of minimapUnits) {
      collectionOf(entity)?.setScaleAt(
        entity.id,
        entity.modelScale ?? 1,
        entity.aspectRatio,
      );
    }
    for (const entity of minimapPlayerEntities) {
      if (isFaded(entity)) {
        collectionOf(entity)?.setAlphaAt(entity.id, entity.alpha);
      }
      setMinimapMask(entity, false);
    }
  };

  // The minimap has no renderer of its own: it borrows the main one, draws its
  // fogged scene into the corner of its drawing buffer and copies that out to
  // its own 2D canvas
  const renderFogAndOverlay = (
    delta: number,
    ctx: CornerContext<Source>,
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
