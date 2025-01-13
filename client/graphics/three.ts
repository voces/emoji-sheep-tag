import { Color, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { center, tiles } from "../../shared/map.ts";
import { Grid } from "./Grid.ts";
import { stats } from "../util/Stats.ts";

const canvas = document.querySelector("canvas");
if (!canvas) throw new Error("Could not find canvas");

export const scene = new Scene();
export const camera = new PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(globalThis.devicePixelRatio);
renderer.setClearColor(new Color(0x333333));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

camera.position.z = 9;
camera.position.x = center.x;
camera.position.y = center.y;
camera.layers.enableAll();

const terrain = new Grid(tiles[0].length, tiles.length);
terrain.layers.set(2);
terrain.position.x = center.x;
terrain.position.y = center.y;
terrain.position.z = -0.01;
scene.add(terrain);
for (let y = 0; y < tiles.length; y++) {
  for (let x = 0; x < tiles[y].length; x++) {
    if (tiles[y][x]) {
      terrain.setColor(
        x,
        y,
        0.07,
        0.03,
        0.12,
      );
    } else {
      terrain.setColor(
        x,
        y,
        0.15,
        0.40,
        0,
      );
    }
  }
}

const resize = () => {
  camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
};

globalThis.addEventListener("resize", resize);
resize();

type RenderListener = (delta: number, time: number) => void;
const renderListeners: RenderListener[] = [];
export const onRender = (fn: RenderListener) => {
  renderListeners.push(fn);
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

  renderer.render(scene, camera);

  stats.end();
};
renderer.setAnimationLoop(animate);

export const getFps = () => fps;
