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
import { cameraBoxOnMinimap } from "./cameraBox.ts";
import { timed } from "../../../graphics/gpuTimings.ts";
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
  position: relative;
  overflow: hidden;

  & > canvas {
    position: static;
    width: 100%;
    max-height: 277px;
    aspect-ratio: 1;
    cursor: pointer;
    display: block;
  }

  /* Where the main camera looks, moved every frame without redrawing the map */
  & > [data-camera-box] {
    position: absolute;
    top: 0;
    left: 0;
    border: 1px solid white;
    box-sizing: border-box;
    pointer-events: none;
    will-change: transform;
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

    const cameraBox = showCameraBox ? document.createElement("div") : null;
    if (cameraBox) {
      cameraBox.setAttribute("data-camera-box", "");
      container.appendChild(cameraBox);
    }

    const pixelRatio = Math.min(globalThis.devicePixelRatio, 2);
    const shown = { width: canvas.clientWidth, height: canvas.clientHeight };
    const resize = (width: number, height: number) => {
      shown.width = width;
      shown.height = height;
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
    );

    let placed = "";
    const placeCameraBox = () => {
      if (!cameraBox) return;
      const { left, top, width, height } = cameraBoxOnMinimap(
        mainCamera,
        camera,
        shown,
      );
      const next = [left, top, width, height].map((v) => v.toFixed(1)).join();
      if (next === placed) return;
      placed = next;
      cameraBox.style.transform = `translate(${left}px, ${top}px)`;
      cameraBox.style.width = `${width}px`;
      cameraBox.style.height = `${height}px`;
    };

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
    // The fog and the copy out to the minimap's canvas each cost the GPU a
    // pass; a minimap needs nothing like every frame of a fast display
    const overlayFrameTime = 1 / 60;
    let timeSinceLastOverlay = overlayFrameTime;

    const disposeRender = onRender((delta) => {
      cameraMovement?.updateCameraSmooth(delta);
      placeCameraBox();

      timeSinceLastSceneRender += delta;
      if (timeSinceLastSceneRender >= frameTime) {
        timed("minimap scene", minimapRenderer.renderScene);
        timeSinceLastSceneRender -= frameTime;
      }

      timeSinceLastOverlay += delta;
      if (timeSinceLastOverlay >= overlayFrameTime) {
        timed(
          "minimap fog and copy",
          () => minimapRenderer.renderFogAndOverlay(timeSinceLastOverlay, ctx),
        );
        timeSinceLastOverlay = 0;
      }
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
      cameraBox?.remove();
    };
  }, []);

  return <Container ref={containerRef} {...props} />;
};
