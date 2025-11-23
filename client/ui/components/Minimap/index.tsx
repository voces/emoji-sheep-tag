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
  width: 262px;
  height: 262px;
  cursor: pointer;
`;

export const Minimap = (props: React.ComponentProps<typeof MinimapCanvas>) => {
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

    const cameraMovement = createCameraMovement(canvas, mainCamera);
    const raycast = createMinimapRaycast(canvas, camera);
    const minimapRenderer = createMinimapRenderer(
      renderer,
      camera,
      scene,
      minimapUnits,
      minimapPlayerEntities,
      pixelRatio,
    );

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;
        renderer.setSize(width, height, false);
      }
    });
    resizeObserver.observe(canvas);

    const targetFPS = 15;
    const frameTime = 1 / targetFPS; // Delta is in seconds, so frameTime should be too
    let timeSinceLastSceneRender = 0;
    let isFirstFrame = true;

    const disposeRender = onRender((delta) => {
      cameraMovement.updateCameraSmooth(delta);

      // Render scene entities at throttled FPS
      if (isFirstFrame) {
        minimapRenderer.renderScene();
        isFirstFrame = false;
        timeSinceLastSceneRender = 0;
      } else {
        timeSinceLastSceneRender += delta;
        if (timeSinceLastSceneRender >= frameTime) {
          minimapRenderer.renderScene();
          timeSinceLastSceneRender -= frameTime;
        }
      }

      // Render fog and overlay at full FPS
      minimapRenderer.renderFogAndOverlay(delta, mainCamera);
    });

    return () => {
      resizeObserver.disconnect();
      unsubscribeMapChange();
      disposeRender();
      cameraMovement.dispose();
      raycast.dispose();
      minimapRenderer.dispose();
    };
  }, [canvas]);

  return <MinimapCanvas ref={setCanvas} data-minimap {...props} />;
};
