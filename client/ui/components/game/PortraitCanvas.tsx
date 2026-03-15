import { useEffect, useRef, useState } from "react";
import {
  Color,
  LinearFilter,
  OrthographicCamera,
  RGBAFormat,
  Scene,
  UnsignedByteType,
  WebGLRenderTarget,
} from "three";
import { styled } from "styled-components";
import { type Entity } from "../../../ecs.ts";
import { AnimatedInstancedMesh } from "../../../graphics/AnimatedInstancedMesh.ts";
import { getAnimatedMeshMaterial } from "../../../graphics/AnimatedMeshMaterial.ts";
import { onRender, renderer } from "../../../graphics/three.ts";
import { collections } from "../../../systems/models.ts";
import {
  computeAnimationParams,
  FADEABLE_ANIMS,
  getResolvedAnimation,
} from "../../../systems/animation.ts";
import { getPlayer } from "@/shared/api/player.ts";

const Canvas = styled.canvas`
  width: 100%;
  height: 100%;
  display: block;
`;

const tmpColor = new Color();

const PORTRAIT_SIZE = 128;

let sharedRenderTarget: WebGLRenderTarget | undefined;
const getSharedRenderTarget = () =>
  sharedRenderTarget ??= new WebGLRenderTarget(PORTRAIT_SIZE, PORTRAIT_SIZE, {
    format: RGBAFormat,
    type: UnsignedByteType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
  });

const pixelBuffer = new Uint8ClampedArray(
  PORTRAIT_SIZE * PORTRAIT_SIZE * 4,
);

export const PortraitCanvas = ({ entity }: { entity: Entity }) => {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const ctx2dRef = useRef<CanvasRenderingContext2D | null>(null);

  const modelName = entity?.model ?? entity?.prefab;

  useEffect(() => {
    if ("Deno" in globalThis || !canvas || !modelName || !renderer) return;

    const collection = collections[modelName];
    if (!(collection instanceof AnimatedInstancedMesh)) return;
    if (collection.cameras.length === 0) return;

    canvas.width = PORTRAIT_SIZE;
    canvas.height = PORTRAIT_SIZE;
    ctx2dRef.current = canvas.getContext("2d");

    const cam = collection.cameras[0];
    const s = collection.modelScale;

    const portraitScene = new Scene();

    const size = cam.size;
    const camera = new OrthographicCamera(
      (cam.x - size) * s,
      (cam.x + size) * s,
      (cam.y - size) * s,
      (cam.y + size) * s,
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
      const animName = getResolvedAnimation(entity);
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

    const rt = getSharedRenderTarget();

    const disposeRender = onRender((delta) => {
      const ctx = ctx2dRef.current;
      if (!ctx || !renderer) return;

      syncAnimation();
      syncColors();
      mesh.decayBlendWeights(delta, 0.15 / 0.2);

      const prevTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x222222, 1);
      renderer.clear();
      renderer.render(portraitScene, camera);
      renderer.readRenderTargetPixels(
        rt,
        0,
        0,
        PORTRAIT_SIZE,
        PORTRAIT_SIZE,
        pixelBuffer,
      );
      renderer.setRenderTarget(prevTarget);

      const imageData = new ImageData(
        pixelBuffer,
        PORTRAIT_SIZE,
        PORTRAIT_SIZE,
      );
      ctx.putImageData(imageData, 0, 0);
    });

    return () => {
      disposeRender();
      mesh.geometry.dispose();
    };
  }, [canvas, modelName, entity.id]);

  return <Canvas ref={setCanvas} />;
};
