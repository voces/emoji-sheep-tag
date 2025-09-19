import { styled } from "styled-components";
import { Panel } from "./common.ts";
import { useEffect, useState } from "react";
import { Color, PerspectiveCamera, WebGLRenderer } from "three";
import { onRender, scene } from "../../../../graphics/three.ts";

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
    camera.position.z = 52;
    camera.position.x = 40;
    camera.position.y = 40;
    camera.layers.enableAll();

    return onRender(() => renderer.render(scene, camera));
  }, [canvas]);

  return <MinimapCanvas ref={setCanvas} />;
};

export const AreaPanel = () => (
  <Panel>
    <Minimap />
  </Panel>
);
