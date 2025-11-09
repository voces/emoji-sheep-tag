import { styled } from "styled-components";
import { useEffect, useState } from "react";
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

export const Minimap = () => {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if ("Deno" in globalThis || !canvas) return;

    const renderer = new WebGLRenderer({ canvas, antialias: true });
    const pixelRatio = Math.min(globalThis.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(new Color(0x333333));
    renderer.setSize(262, 262, false);

    const camera = new PerspectiveCamera(75, 1, 0.1, 1000);
    const updateCamera = () => {
      const map = getMap();
      camera.position.z = map.width * 0.65;
      camera.position.x = map.width / 2;
      camera.position.y = map.height / 2;
    };
    updateCamera();
    const unsubscribe = onMapChange(updateCamera);
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

    const disposeRender = onRender((delta) => {
      cameraMovement.updateCameraSmooth(delta);
      minimapRenderer.render(delta, mainCamera);
    });

    return () => {
      unsubscribe();
      disposeRender();
      cameraMovement.dispose();
      raycast.dispose();
      minimapRenderer.dispose();
    };
  }, [canvas]);

  return <MinimapCanvas ref={setCanvas} id="minimap" />;
};
