import { styled } from "styled-components";
import React, { useEffect, useState } from "react";
import { Color, PerspectiveCamera, WebGLRenderer } from "three";
import {
  camera as mainCamera,
  onRender,
  scene,
} from "../../../graphics/three.ts";
import { getMap, onMapChange } from "@/shared/map.ts";
import { type Entity } from "../../../ecs.ts";
import { isUnit } from "@/shared/api/unit.ts";
import { addSystem } from "@/shared/context.ts";
import { createCameraMovement } from "./cameraMovement.ts";
import { createMinimapRaycast } from "./raycasting.ts";
import { createMinimapRenderer } from "./rendering.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";

const minimapUnits = new Set<Entity>();
const minimapPlayerEntities = new Set<Entity>();

addSystem({
  props: ["id"],
  onAdd: (entity) => {
    if (isUnit(entity)) {
      minimapUnits.add(entity);
    } else if (entity.owner) {
      minimapPlayerEntities.add(entity);
    }
  },
  onRemove: (entity) => {
    minimapUnits.delete(entity);
    minimapPlayerEntities.delete(entity);
  },
});

const MinimapCanvas = styled.canvas`
  position: static;
  width: 277px;
  height: 277px;
  cursor: pointer;
`;

export const Minimap = (
  { showCameraBox = true, interactive = true, disableFog = false, ...props }:
    & React.ComponentProps<typeof MinimapCanvas>
    & { showCameraBox?: boolean; interactive?: boolean; disableFog?: boolean },
) => {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if ("Deno" in globalThis || !canvas) return;

    const renderer = new WebGLRenderer({ canvas, antialias: true });
    const pixelRatio = Math.min(globalThis.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(new Color(0x333333));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    const camera = new PerspectiveCamera(75, 1, 0.1, 1000);
    const updateCamera = () => {
      const map = getMap();
      camera.position.z = Math.max(
        map.bounds.max.x - map.bounds.min.x,
        map.bounds.max.y - map.bounds.min.y,
      ) * 0.65;
      camera.position.x = (map.bounds.max.x + map.bounds.min.x) / 2;
      camera.position.y = (map.bounds.max.y + map.bounds.min.y) / 2;
    };
    updateCamera();
    const unsubscribeMapChange = onMapChange(updateCamera);
    camera.layers.enableAll();

    const cameraMovement = interactive
      ? createCameraMovement(canvas, mainCamera)
      : null;
    const raycast = interactive ? createMinimapRaycast(canvas, camera) : null;
    const minimapRenderer = createMinimapRenderer(
      renderer,
      camera,
      scene,
      minimapUnits,
      minimapPlayerEntities,
      pixelRatio,
      showCameraBox,
    );

    minimapRenderer.setDisableFogOfWar(disableFog || lobbySettingsVar().view);
    const unsubscribeLobbySettings = disableFog
      ? null
      : lobbySettingsVar.subscribe((settings) => {
        minimapRenderer.setDisableFogOfWar(settings.view);
      });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;
        renderer.setSize(width, height, false);
      }
    });
    resizeObserver.observe(canvas);

    // Eagerly compile minimap-specific shaders in parallel, then warm up
    // the game scene materials with a single offscreen render
    let disposed = false;
    let disposeRender: (() => void) | undefined;

    minimapRenderer.compileAsync().then(() => {
      if (disposed) return;

      // Warm up game scene materials (triggers synchronous compilation once)
      minimapRenderer.renderScene();

      const targetFPS = 15;
      const frameTime = 1 / targetFPS;
      let timeSinceLastSceneRender = 0;

      disposeRender = onRender((delta) => {
        cameraMovement?.updateCameraSmooth(delta);

        timeSinceLastSceneRender += delta;
        if (timeSinceLastSceneRender >= frameTime) {
          minimapRenderer.renderScene();
          timeSinceLastSceneRender -= frameTime;
        }

        minimapRenderer.renderFogAndOverlay(delta, mainCamera);
      });
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      unsubscribeMapChange();
      unsubscribeLobbySettings?.();
      disposeRender?.();
      cameraMovement?.dispose();
      raycast?.dispose();
      minimapRenderer.dispose();
      renderer.forceContextLoss();
      renderer.dispose();
    };
  }, [canvas]);

  return <MinimapCanvas ref={setCanvas} data-minimap data-game-ui {...props} />;
};
