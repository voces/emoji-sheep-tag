import { styled } from "styled-components";
import React, { useEffect, useRef } from "react";
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

// --- Renderer pool ---

type PoolEntry = {
  canvas: HTMLCanvasElement;
  renderer: WebGLRenderer;
  pixelRatio: number;
  timer?: number;
};

const pool: PoolEntry[] = [];
const compiled = new WeakSet<WebGLRenderer>();
const POOL_EXPIRY_MS = 60_000;

const acquire = (): PoolEntry => {
  const entry = pool.pop();
  if (entry) {
    clearTimeout(entry.timer);
    delete entry.timer;
    return entry;
  }
  const canvas = document.createElement("canvas");
  const pixelRatio = Math.min(globalThis.devicePixelRatio, 2);
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(new Color(0x333333));
  return { canvas, renderer, pixelRatio };
};

const release = (entry: PoolEntry) => {
  entry.timer = setTimeout(() => {
    const idx = pool.indexOf(entry);
    if (idx >= 0) pool.splice(idx, 1);
    entry.renderer.forceContextLoss();
    entry.renderer.dispose();
  }, POOL_EXPIRY_MS);
  pool.push(entry);
};

// --- Component ---

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
    if ("Deno" in globalThis || !container) return;

    const entry = acquire();
    const { canvas, renderer, pixelRatio } = entry;

    // Copy data attributes to canvas for minimap click detection
    canvas.setAttribute("data-minimap", "");
    canvas.setAttribute("data-game-ui", "");
    // Reset inline size so CSS rules apply in the new container
    canvas.style.width = "";
    canvas.style.height = "";
    canvas.style.aspectRatio = "";
    container.appendChild(canvas);

    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

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
        renderer.setSize(e.contentRect.width, e.contentRect.height, false);
      }
    });
    resizeObserver.observe(canvas);

    let disposed = false;
    let disposeRender: (() => void) | undefined;

    const startRendering = () => {
      if (disposed) return;

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
    };

    let compilePromise: Promise<unknown> | undefined;
    if (compiled.has(renderer)) {
      startRendering();
    } else {
      compilePromise = minimapRenderer.compileAsync().then(() => {
        compiled.add(renderer);
        startRendering();
      });
    }

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      unsubscribeMapChange();
      unsubscribeLobbySettings?.();
      disposeRender?.();
      cameraMovement?.dispose();
      raycast?.dispose();
      if (compilePromise) {
        compilePromise.catch(() => {}).finally(() => minimapRenderer.dispose());
      } else {
        minimapRenderer.dispose();
      }
      canvas.remove();
      release(entry);
    };
  }, []);

  return <Container ref={containerRef} {...props} />;
};
