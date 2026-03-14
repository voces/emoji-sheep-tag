import { useEffect, useState } from "react";
import { Color, OrthographicCamera, Scene, WebGLRenderer } from "three";
import { styled } from "styled-components";
import { type Entity } from "../../../ecs.ts";
import { AnimatedInstancedMesh } from "../../../graphics/AnimatedInstancedMesh.ts";
import { getAnimatedMeshMaterial } from "../../../graphics/AnimatedMeshMaterial.ts";
import { onRender } from "../../../graphics/three.ts";
import { collections } from "../../../systems/models.ts";
import {
  computeAnimationParams,
  FADEABLE_ANIMS,
  getCurrentAnimation,
} from "../../../systems/animation.ts";
import { getPlayer } from "@/shared/api/player.ts";

const Canvas = styled.canvas`
  width: 100%;
  height: 100%;
  display: block;
`;

const tmpColor = new Color();

export const PortraitCanvas = ({ entity }: { entity: Entity }) => {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  const modelName = entity?.model ?? entity?.prefab;

  useEffect(() => {
    if ("Deno" in globalThis || !canvas || !modelName) return;

    const collection = collections[modelName];
    if (!(collection instanceof AnimatedInstancedMesh)) return;
    if (collection.cameras.length === 0) return;

    const cam = collection.cameras[0];
    const s = collection.modelScale;

    const renderer = new WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.setClearColor(0x222222, 1);

    const portraitScene = new Scene();

    const size = cam.size;
    const camera = new OrthographicCamera(
      (cam.x - size) * s,
      (cam.x + size) * s,
      (cam.y + size) * s,
      (cam.y - size) * s,
      0.1,
      100,
    );
    camera.position.set(0, 0, 10);
    camera.layers.enableAll();

    const material = getAnimatedMeshMaterial();

    const mesh = new AnimatedInstancedMesh(
      collection.geometry.clone(),
      material,
      1,
      modelName,
      collection.animationData ?? undefined,
    );
    mesh.setPositionAt(0, 0, 0);
    mesh.frustumCulled = false;
    portraitScene.add(mesh);

    mesh.depthMesh.renderOrder = -0.001;
    mesh.depthMesh.frustumCulled = false;
    portraitScene.add(mesh.depthMesh);

    const geo = mesh.geometry;
    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    let lastAnimName: string | undefined;

    const syncAnimation = () => {
      const animName = getCurrentAnimation(entity);
      if (animName === lastAnimName) return;
      const shouldCrossfade = FADEABLE_ANIMS.has(lastAnimName ?? "");
      lastAnimName = animName;
      const { phase, speed } = computeAnimationParams(
        animName,
        collection,
        entity,
      );
      mesh.setAnimationAt(
        0,
        animName ?? "default",
        phase,
        speed,
        shouldCrossfade,
      );
    };

    const syncColors = () => {
      const accentColor = entity.playerColor ??
        getPlayer(entity.owner)?.playerColor;
      if (accentColor) {
        mesh.setPlayerColorAt(0, tmpColor.set(accentColor));
      }
      if (typeof entity.vertexColor === "number") {
        mesh.setVertexColorAt(0, tmpColor.setHex(entity.vertexColor));
      }
      mesh.setAlphaAt(0, entity.alpha ?? 1);
    };

    const disposeRender = onRender((delta) => {
      syncAnimation();
      syncColors();
      mesh.decayBlendWeights(delta, 0.15 / 0.2);
      renderer.render(portraitScene, camera);
    });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        renderer.setSize(
          entry.contentRect.width,
          entry.contentRect.height,
          false,
        );
      }
    });
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
      disposeRender();
      renderer.dispose();
    };
  }, [canvas, modelName, entity.id]);

  return <Canvas ref={setCanvas} />;
};
