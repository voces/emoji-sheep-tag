import {
  AudioListener,
  Color,
  DepthTexture,
  type Material,
  type Object3D,
  PerspectiveCamera,
  Scene,
  UnsignedInt248Type,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { getMap, type LoadedMap, onMapChange } from "@/shared/map.ts";
import { addSystem } from "@/shared/context.ts";
import { stats } from "../util/Stats.ts";
import { prefabs, tileDefs } from "@/shared/data.ts";
import { type DoodadPoint, Terrain2D } from "./Terrain2D.ts";
import { FogPass } from "./FogPass.ts";
import { gpuInfoOf } from "../util/gpu.ts";
import { placeListenerWhenMoved } from "./audioPlacement.ts";
import {
  gpuTimingsFrame,
  isTimingGpu,
  startGpuTimings,
  timed,
} from "./gpuTimings.ts";
import { floatingTextScene } from "../systems/floatingText.ts";
import { healthbarScene } from "../systems/healthbars.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { isNight } from "@/shared/dayNight.ts";
import { ambientBirdsSound } from "../api/sound.ts";
import { editorVar, editorWaterViewVar } from "@/vars/editor.ts";
import { stateVar } from "@/vars/state.ts";
import { Entity } from "../ecs.ts";
import { clearGeneratedFlowers, regenerateFlowers } from "../flowers.ts";

const terrainTilePalette = tileDefs.map((t) => ({
  color: `#${t.color.toString(16).padStart(6, "0")}`,
  strength: t.strength,
  noiseFreq: t.noiseFreq,
  noiseAmp: t.noiseAmp,
}));

const extractDoodads = (map: LoadedMap): DoodadPoint[] =>
  map.entities
    .filter((e) =>
      e.prefab && e.prefab !== "flowers" &&
      e.position &&
      prefabs[e.prefab as keyof typeof prefabs]?.isDoodad
    )
    .map((e) => ({
      x: e.position!.x,
      y: e.position!.y,
      radius: prefabs[e.prefab as keyof typeof prefabs]?.radius ?? 0.5,
    }));

const createTerrainMasks = (map: LoadedMap = getMap()) => ({
  cliff: map.cliffs.toReversed(),
  groundTile: map.tiles.toReversed(),
  cliffTile: Array.from(
    { length: map.height },
    () => Array(map.width).fill(0),
  ),
  water: map.water.toReversed(),
});

const canvas = document.querySelector("canvas") ?? undefined;

export const scene = new Scene();
// The scenes never move; recomputing one's matrix each render would force every
// object in it to recompute its own, the many that never move included
for (const still of [scene, healthbarScene, floatingTextScene]) {
  still.matrixAutoUpdate = false;
}
export const camera = new PerspectiveCamera(
  75,
  globalThis.innerWidth / globalThis.innerHeight,
  0.1,
  1000,
);
Object.assign(globalThis, { camera, scene });

// undefined in tests
export let renderer: WebGLRenderer | undefined;
export let renderTarget: WebGLRenderTarget | undefined;
export let fogPass: FogPass | undefined;
export const setFogPass = (pass: FogPass) => {
  fogPass = pass;
};

if (!("Deno" in globalThis)) {
  renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(globalThis.devicePixelRatio);
  // The dark grass past the map's edge, shown wherever nothing has drawn
  renderer.setClearColor(new Color(0x020a00));
  renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
  document.body.appendChild(renderer.domElement);
  // Asked now, before any shader is sent to compile, the driver answers at once
  gpuInfoOf(renderer.getContext());
  Object.assign(globalThis, { renderer });

  const width = globalThis.innerWidth * globalThis.devicePixelRatio;
  const height = globalThis.innerHeight * globalThis.devicePixelRatio;

  // Render target with depth texture for fog shader
  // Keep it in LinearSRGBColorSpace (default) - the fog shader will handle gamma
  renderTarget = new WebGLRenderTarget(width, height, {
    depthBuffer: true,
    depthTexture: new DepthTexture(width, height, UnsignedInt248Type),
    samples: 4, // WebGL2 MSAA
  });
}

camera.position.z = 9;
const initialMap = getMap();
camera.position.x = initialMap.center.x;
camera.position.y = initialMap.center.y;
camera.layers.enableAll();

export const listener = "AudioListener" in globalThis
  ? placeListenerWhenMoved(new AudioListener())
  : undefined;

export type Channel = "master" | "sfx" | "ui" | "ambience";
export const channels: { [K in Channel]?: GainNode } = {};

if (listener) {
  Object.assign(globalThis, { listener });
  camera.add(listener);

  // Web Audio context behind the listener
  const ctx = listener.context;

  // 1) pre-gain (lets you drive how hard you hit the compressor)
  const preGain = ctx.createGain();
  preGain.gain.value = 1.0;

  // 2) gentle bus compressor
  const busComp = ctx.createDynamicsCompressor();
  busComp.threshold.setValueAtTime(-18, ctx.currentTime); // starts compressing at -18 dB
  busComp.knee.setValueAtTime(12, ctx.currentTime); // soft onset
  busComp.ratio.setValueAtTime(4, ctx.currentTime); // moderate 4:1
  busComp.attack.setValueAtTime(0.01, ctx.currentTime); // 10 ms attack
  busComp.release.setValueAtTime(0.2, ctx.currentTime); // 200 ms release

  // 3) make-up gain (optional, adjust by ear)
  const makeUp = ctx.createGain();
  makeUp.gain.value = 1.1;

  // 4) safety limiter (only catches peaks)
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-2, ctx.currentTime); // just under 0 dB
  limiter.knee.setValueAtTime(0, ctx.currentTime); // hard knee
  limiter.ratio.setValueAtTime(20, ctx.currentTime); // limiting
  limiter.attack.setValueAtTime(0.002, ctx.currentTime); // very fast attack
  limiter.release.setValueAtTime(0.1, ctx.currentTime); // short release

  // Wire up the chain: all sounds go -> preGain -> busComp -> makeUp -> limiter -> destination
  preGain.connect(busComp).connect(makeUp).connect(limiter).connect(
    ctx.destination,
  );

  // Redirect listener’s output into the chain
  listener.gain.disconnect();
  listener.gain.connect(preGain);

  // Setup channels
  channels.master = ctx.createGain();

  channels.sfx = ctx.createGain();
  channels.sfx.connect(channels.master);

  channels.ui = ctx.createGain();
  channels.ui.connect(channels.master);

  channels.ambience = ctx.createGain();
  channels.ambience.connect(channels.master);

  channels.master.connect(preGain);

  // Initialize audio settings after channels are set up
  // This import must be done after channels are created
  import("@/vars/audioSettings.ts");
}

/** The layer the terrain draws on, apart from the sprites. */
const TERRAIN_LAYER = 3;

export const terrain = new Terrain2D(
  createTerrainMasks(initialMap),
  terrainTilePalette,
  extractDoodads(initialMap),
);
terrain.layers.set(TERRAIN_LAYER);
terrain.position.z = -0.002;
terrain.scale.setScalar(0.5);
scene.add(terrain);
let currentTerrainMapId = initialMap.id;
onMapChange((map) => {
  const terrainChanged = map.id !== currentTerrainMapId;
  if (terrainChanged) {
    currentTerrainMapId = map.id;
    terrain.load(
      createTerrainMasks(map),
      terrainTilePalette,
      extractDoodads(map),
    );
  }
  try {
    clearGeneratedFlowers();
    regenerateFlowers(getTerrainData());
  } catch { /* app context not yet available */ }
  if (!terrainChanged) return;
  if (editorVar() && map.id.includes("-resized-")) return;
  camera.position.x = map.center.x;
  camera.position.y = map.center.y;
});

const getTerrainData = () => ({
  cliff: terrain.masks.cliff,
  groundTile: terrain.masks.groundTile,
  water: terrain.masks.water,
  doodads: terrain.doodads,
  cliffField: terrain.cliffField,
});

let flowerDebounce: number | undefined;
export const triggerFlowerRegeneration = () => {
  clearTimeout(flowerDebounce);
  regenerateFlowers(getTerrainData());
};
terrain.onChange = () => {
  if (!editorVar()) return;
  clearTimeout(flowerDebounce);
  flowerDebounce = setTimeout(
    () => regenerateFlowers(getTerrainData()),
    300,
  );
};
const waterViewModeId: Record<
  ReturnType<typeof editorWaterViewVar>,
  0 | 1 | 2
> = { hide: 0, normal: 1, level: 2 };
const applyWaterViewMode = () => {
  const mode = editorVar() ? waterViewModeId[editorWaterViewVar()] : 1;
  terrain.setWaterViewMode(mode);
};
applyWaterViewMode();
editorWaterViewVar.subscribe(applyWaterViewMode);
editorVar.subscribe(applyWaterViewMode);

const doodads = new Map<Entity, DoodadPoint>();
let queued = false;
const queueRebuild = () => {
  if (queued) return;
  queued = true;
  setTimeout(() => {
    queued = false;
    terrain.setDoodads(Array.from(doodads.values()));
  }, 0);
};
addSystem({
  props: ["isDoodad", "position", "radius"],
  onAdd: (e) => {
    if (e.prefab === "flowers" || e.isEffect) return;
    doodads.set(e, {
      x: e.position.x,
      y: e.position.y,
      radius: e.radius,
    });
    queueRebuild();
  },
  onChange: (e) => {
    if (e.prefab === "flowers" || e.isEffect) return;
    doodads.set(e, {
      x: e.position.x,
      y: e.position.y,
      radius: e.radius,
    });
    queueRebuild();
  },
  onRemove: (e) => doodads.delete(e) && queueRebuild(),
});

// deno-lint-ignore no-explicit-any
(globalThis as any).terrain = terrain;

const BASE_FOV = 50;
const BASE_HEIGHT = 720;
// Convert BASE_FOV from degrees to radians and compute half-angle tangent
const BASE_TAN = Math.tan((BASE_FOV * Math.PI) / 180 / 2);

const resize = () => {
  // Get the new window dimensions
  const newWidth = globalThis.innerWidth;
  const newHeight = globalThis.innerHeight;

  // Compute the new half FOV in radians using the ratio of newHeight to BASE_HEIGHT
  const newFovHalfRad = Math.atan((newHeight / BASE_HEIGHT) * BASE_TAN);

  // The new FOV is twice the half-angle (convert back to degrees)
  const newFovDeg = (2 * newFovHalfRad * 180) / Math.PI;

  // Update camera properties:
  camera.fov = newFovDeg;
  camera.aspect = newWidth / newHeight;
  camera.updateProjectionMatrix();

  // Update renderer size
  renderer?.setSize(newWidth, newHeight);

  // Update render target with pixel ratio
  const width = newWidth * globalThis.devicePixelRatio;
  const height = newHeight * globalThis.devicePixelRatio;
  renderTarget?.setSize(width, height);
};

globalThis.addEventListener("resize", resize);
resize();

type RenderListener = (deltaSeconds: number, timeSeconds: number) => void;
const renderListeners: RenderListener[] = [];
export const onRender = (fn: RenderListener) => {
  renderListeners.push(fn);
  return () => {
    const idx = renderListeners.indexOf(fn);
    if (idx >= 0) renderListeners.splice(idx, 1);
  };
};

// Per-pass GPU times and draws, when the page is opened with `?gpu-timings`
const timedContext = renderer?.getContext();
if (
  renderer && timedContext && "createQuery" in timedContext &&
  new URLSearchParams(globalThis.location?.search).has("gpu-timings")
) {
  startGpuTimings(timedContext, renderer, (averages) => {
    Object.assign(globalThis, { gpuTimings: averages });
    console.table(averages);
  });
}

let last = performance.now() / 1000;
const frameTimes: number[] = [];
let fps = 0;
let nightAmount = 0;
/** Materials whose programs have been sent to compile ahead. */
const compiledMaterials = new WeakSet<Material>();

const drawsWithMaterial = (
  object: Object3D,
): object is Object3D & { material: Material | Material[] } =>
  "material" in object && !!object.material;

const isCompiled = (material: Material) => compiledMaterials.has(material);

/** Whether anything under `root` draws with a material not yet compiled. */
const hasUncompiled = (root: Object3D) => {
  const stack: Object3D[] = [root];
  for (let object = stack.pop(); object; object = stack.pop()) {
    if (drawsWithMaterial(object)) {
      const { material } = object;
      if (
        Array.isArray(material)
          ? !material.every(isCompiled)
          : !isCompiled(material)
      ) return true;
    }
    for (let i = 0; i < object.children.length; i++) {
      stack.push(object.children[i]);
    }
  }
  return false;
};

const markCompiled = (root: Object3D) =>
  root.traverse((object) => {
    if (!drawsWithMaterial(object)) return;
    for (const material of [object.material].flat()) {
      compiledMaterials.add(material);
    }
  });

let programsCompiling: Promise<void> | undefined;
const animate = () => {
  const time = performance.now() / 1000;
  const delta = time - last;
  last = time;

  frameTimes.push(delta);
  if (frameTimes.length > 100) frameTimes.shift();
  fps = 1 / (frameTimes.reduce((a, b) => a + b) / frameTimes.length);

  stats.begin();

  for (let i = 0; i < renderListeners.length; i++) {
    renderListeners[i](delta, time);
  }

  terrain.setTime(time);

  if (!renderer || !fogPass || !renderTarget) return;

  // Where the driver compiles in parallel, programs compile before they are
  // first drawn, off the main thread, rather than one after another as a frame
  // draws: for the first frame, and whenever something brings a material not
  // yet compiled, such as the first healthbar. The last frame stays up and the
  // game runs on meanwhile. Elsewhere that would only compile hidden materials
  // early, so they compile as first drawn
  if (
    !programsCompiling &&
    renderer.extensions.has("KHR_parallel_shader_compile") &&
    [scene, healthbarScene, floatingTextScene].some(hasUncompiled)
  ) {
    // A program is built for the target it draws into, so each scene compiles
    // against the one it renders to
    const gl = renderer, target = renderTarget;
    const compileWorld = () => {
      markCompiled(scene);
      gl.setRenderTarget(target);
      const world = gl.compileAsync(scene, camera);
      gl.setRenderTarget(null);
      return world;
    };
    markCompiled(healthbarScene);
    markCompiled(floatingTextScene);
    const programs = renderer.info.programs?.length ?? 0;
    const first = [
      compileWorld(),
      fogPass.compileAsync(renderer, renderTarget),
      renderer.compileAsync(healthbarScene, camera),
      renderer.compileAsync(floatingTextScene, camera),
    ];
    const compiling = Promise.all(first).catch(() => {});
    // New materials whose programs were built before need no waiting for
    if ((renderer.info.programs?.length ?? 0) > programs) {
      programsCompiling = compiling.then(() => {
        programsCompiling = undefined;
      });
    }
  }
  // While programs compile, the passes that may draw with them hold off, and
  // the fog pass shows the last world drawn: a frame or two stale, rather than
  // stalled, or blank where only the minimap and portrait drew
  const holding = !!programsCompiling;

  fogPass.updateCamera(camera);
  fogPass.setDisableFogOfWar(
    lobbySettingsVar().view || stateVar() !== "playing",
  );

  // Smoothly interpolate night tint and ambient volume
  const nightTarget = isNight() ? 1 : 0;
  nightAmount += (nightTarget - nightAmount) * Math.min(delta * 0.5, 1);
  fogPass.setNightAmount(nightAmount);
  if (ambientBirdsSound?.gain) {
    const ctx = ambientBirdsSound.context;
    ambientBirdsSound.gain.gain.setTargetAtTime(
      0.05 * (1 - nightAmount * 0.95),
      ctx.currentTime,
      0.5,
    );
  }

  // Render scene to non-MSAA target with depth
  const gl = renderer, target = renderTarget, fog = fogPass;
  gl.setRenderTarget(target);
  if (!holding) {
    gl.clear();
    if (isTimingGpu()) {
      // Drawn in two only to time them apart: the terrain on its own layer,
      // then the rest over it
      const layers = camera.layers.mask;
      timed("terrain", () => {
        camera.layers.set(TERRAIN_LAYER);
        gl.render(scene, camera);
      });
      timed("sprites", () => {
        camera.layers.mask = layers;
        camera.layers.disable(TERRAIN_LAYER);
        gl.autoClear = false;
        gl.render(scene, camera);
        gl.autoClear = true;
      });
      camera.layers.mask = layers;
    } else gl.render(scene, camera);
  }

  // Apply fog pass (includes boundary fog, fog of war optional)
  timed("fog", () => fog.render(gl, target, target, delta));
  gl.setRenderTarget(null);

  if (holding) return;

  // Render healthbars and floating text on top
  timed("healthbars and text", () => {
    gl.autoClear = false;
    gl.render(healthbarScene, camera);
    gl.render(floatingTextScene, camera);
    gl.autoClear = true;
  });
  gpuTimingsFrame(time);

  stats.end();
};
renderer?.setAnimationLoop(animate);

export const getFps = () => fps;
export const getSpeedMultiplier = () => lobbySettingsVar().speedMultiplier ?? 1;
