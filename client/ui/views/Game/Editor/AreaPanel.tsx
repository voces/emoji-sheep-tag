import { styled } from "styled-components";
import { Panel } from "./common.ts";
import { useEffect, useState } from "react";
import { Color, PerspectiveCamera, WebGLRenderer } from "three";
import { onRender, scene } from "../../../../graphics/three.ts";
import { getMap, onMapChange } from "@/shared/map.ts";

const MinimapCanvas = styled.canvas`
  position: static;
  width: 262px;
  height: 262px;
`;

const Minimap = () => {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if ("Deno" in globalThis || !canvas) return;

    const renderer = new WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2));
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

    const disposeRender = onRender(() => renderer.render(scene, camera));
    return () => {
      unsubscribe();
      disposeRender();
    };
  }, [canvas]);

  return <MinimapCanvas ref={setCanvas} />;
};

export const AreaPanel = () => (
  <Panel>
    <Minimap />
  </Panel>
);
