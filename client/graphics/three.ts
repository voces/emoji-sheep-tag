import { Color, PerspectiveCamera, Scene, WebGLRenderer } from "three";

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
renderer.setClearColor(new Color(0x63CB00));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

camera.position.z = 9;
camera.position.x = 25;
camera.position.y = 25;

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

let last = Date.now() / 1000;
const animate = () => {
  const time = Date.now() / 1000;
  const delta = time - last;
  last = time;

  for (let i = 0; i < renderListeners.length; i++) {
    renderListeners[i](delta, time);
  }

  renderer.render(scene, camera);
};
renderer.setAnimationLoop(animate);
