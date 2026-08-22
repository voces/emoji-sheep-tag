import { styled } from "styled-components";
import React, { useEffect, useRef } from "react";
import { PerspectiveCamera } from "three";
import {
  camera as mainCamera,
  onRender,
  renderer,
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

const Container = styled.div`
  & > canvas {
    position: static;
    width: 100%;
    max-height: 277px;
    aspect-ratio: 1;
    cursor: pointer;
    display: block;
  }
`;

export const Minimap = (
  { showCameraBox = true, interactive = true, disableFog = false, ...props }:
    & React.ComponentProps<typeof Container>
    & { showCameraBox?: boolean; interactive?: boolean; disableFog?: boolean },
) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!renderer || !container) return;

    const canvas = document.createElement("canvas");
    // Data attributes drive minimap click detection
    canvas.setAttribute("data-minimap", "");
    canvas.setAttribute("data-game-ui", "");
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    container.appendChild(canvas);

    const pixelRatio = Math.min(globalThis.devicePixelRatio, 2);
    const resize = (width: number, height: number) => {
      const w = Math.max(1, Math.round(width * pixelRatio));
      const h = Math.max(1, Math.round(height * pixelRatio));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
    };

    const camera = new PerspectiveCamera(75, 1, 0.1, 1000);
    const updateCamera = () => {
      const map = getMap();
      const bx = map.bounds.max.x - map.bounds.min.x;
      const by = map.bounds.max.y - map.bounds.min.y;
      const aspect = by > 0 ? Math.max(1, bx / by) : 1;
      camera.aspect = aspect;
      camera.position.z = Math.max(bx, by) / aspect * 0.65;
      camera.position.x = (map.bounds.max.x + map.bounds.min.x) / 2;
      camera.position.y = (map.bounds.max.y + map.bounds.min.y) / 2;
      camera.updateProjectionMatrix();
      canvas.style.aspectRatio = String(aspect);
    };
    updateCamera();
    resize(canvas.clientWidth, canvas.clientHeight);
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
      for (const e of entries) {
        resize(e.contentRect.width, e.contentRect.height);
      }
    });
    resizeObserver.observe(canvas);

    minimapRenderer.renderScene();

    const targetFPS = 15;
    const frameTime = 1 / targetFPS;
    let timeSinceLastSceneRender = 0;

    const disposeRender = onRender((delta) => {
      cameraMovement?.updateCameraSmooth(delta);

      timeSinceLastSceneRender += delta;
      if (timeSinceLastSceneRender >= frameTime) {
        minimapRenderer.renderScene();
        timeSinceLastSceneRender -= frameTime;
      }

      minimapRenderer.renderFogAndOverlay(delta, mainCamera, ctx);
    });

    return () => {
      resizeObserver.disconnect();
      unsubscribeMapChange();
      unsubscribeLobbySettings?.();
      disposeRender();
      cameraMovement?.dispose();
      raycast?.dispose();
      minimapRenderer.dispose();
      canvas.remove();
    };
  }, []);

  return <Container ref={containerRef} {...props} />;
};
