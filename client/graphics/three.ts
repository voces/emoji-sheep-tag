import {
  AudioListener,
  Color,
  DepthTexture,
  PerspectiveCamera,
  Scene,
  UnsignedInt248Type,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { getMap, type LoadedMap, onMapChange } from "@/shared/map.ts";
import { stats } from "../util/Stats.ts";
import { tileDefs } from "@/shared/data.ts";
import { Terrain2D } from "./Terrain2D.ts";
import { FogPass } from "./FogPass.ts";
import { floatingTextScene } from "../systems/floatingText.ts";

const terrainTilePalette = [
  ...tileDefs.map((t) => ({
    color: `#${t.color.toString(16).padStart(6, "0")}`,
  })),
  { color: "#dbbba3" },
];

const createTerrainMasks = (map: LoadedMap = getMap()) => ({
  cliff: map.cliffs.toReversed(),
  groundTile: map.tiles.toReversed(),
  cliffTile: Array.from(
    { length: map.height },
    () => Array(map.width).fill(tileDefs.length),
  ),
});

const canvas = document.querySelector("canvas");
if (!canvas) throw new Error("Could not find canvas");

export const scene = new Scene();
export const camera = new PerspectiveCamera(
  75,
  globalThis.innerWidth / globalThis.innerHeight,
  0.1,
  1000,
);
Object.assign(globalThis, { camera });

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
  renderer.setClearColor(new Color(0x333333));
  renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
  document.body.appendChild(renderer.domElement);

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
  ? new AudioListener()
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

export const terrain = new Terrain2D(
  createTerrainMasks(initialMap),
  terrainTilePalette,
);
terrain.layers.set(3);
terrain.position.z = -0.002;
terrain.scale.setScalar(0.5);
if ("depthWrite" in terrain.material) terrain.material.depthWrite = false;
scene.add(terrain);
let currentTerrainMapId = initialMap.id;
onMapChange((map) => {
  if (map.id === currentTerrainMapId) return;
  currentTerrainMapId = map.id;
  terrain.load(createTerrainMasks(map), terrainTilePalette);
  camera.position.x = map.center.x;
  camera.position.y = map.center.y;
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

type RenderListener = (delta: number, time: number) => void;
const renderListeners: RenderListener[] = [];
export const onRender = (fn: RenderListener) => {
  renderListeners.push(fn);
  return () => {
    const idx = renderListeners.indexOf(fn);
    if (idx >= 0) renderListeners.splice(idx, 1);
  };
};

let last = performance.now() / 1000;
const frameTimes: number[] = [];
let fps = 0;
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

  if (!renderer || !fogPass || !renderTarget) return;

  fogPass.updateCamera(camera);

  // Render scene to non-MSAA target with depth
  renderer.setRenderTarget(renderTarget);
  renderer.clear();
  renderer.render(scene, camera);

  // Apply fog pass
  fogPass.render(renderer, renderTarget, renderTarget, delta);
  renderer.setRenderTarget(null);

  // Render floating text on top
  renderer.autoClear = false;
  renderer.render(floatingTextScene, camera);
  renderer.autoClear = true;

  stats.end();
};
renderer?.setAnimationLoop(animate);

export const getFps = () => fps;
