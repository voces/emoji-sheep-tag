import { TypedEventTarget } from "typed-event-target";
import {
  Intersection,
  Object3D,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { camera, scene } from "./three.ts";
// import { camera, scene } from "../graphics.ts";
// import { getCharacter } from "../character.ts";

class MosueEvent extends Event {
  readonly pixels: Vector2;
  readonly percent: Vector2;
  readonly world: Vector2;
  readonly angle: number;
  readonly intersects: Intersection<Object3D>[];

  constructor(name: string) {
    super(name);

    this.pixels = mouse.pixels.clone();
    this.percent = mouse.percent.clone();
    this.world = mouse.world.clone();
    this.angle = mouse.angle;
    this.intersects = [...mouse.intersects];
  }
}

export class MouseButtonEvent extends MosueEvent {
  constructor(
    direction: "up" | "down",
    readonly button: "left" | "right" | "middle",
  ) {
    super(`mouseButton${direction[0].toUpperCase() + direction.slice(1)}`);
  }
}

export class MouseMoveEvent extends MosueEvent {
  constructor() {
    super("mouseMove");
  }
}

type MouseEvents = {
  mouseButtonDown: MouseButtonEvent;
  mouseButtonUp: MouseButtonEvent;
  mouseMove: MouseMoveEvent;
};

class MouseEventTarget extends TypedEventTarget<MouseEvents> {}

type Mouse = {
  pixels: Vector2;
  percent: Vector2;
  world: Vector2;
  angle: number;
  intersects: Intersection<Object3D>[];
};

export const mouse: MouseEventTarget & Mouse = Object.assign(
  new MouseEventTarget(),
  {
    pixels: new Vector2(),
    percent: new Vector2(),
    world: new Vector2(),
    angle: 0,
    intersects: [],
  },
);

const raycaster = new Raycaster();

const cameraSpace = new Vector2();

const plane = new Plane(new Vector3(0, 0, 1), 0);

const world3 = new Vector3();

globalThis.addEventListener("pointermove", (event) => {
  mouse.pixels.x = event.clientX;
  mouse.pixels.y = event.clientY;
  mouse.percent.x = event.clientX / window.innerWidth;
  mouse.percent.y = event.clientY / window.innerHeight;
  cameraSpace.x = mouse.percent.x * 2 - 1;
  cameraSpace.y = mouse.percent.y * -2 + 1;

  raycaster.setFromCamera(cameraSpace, camera);
  if (mouse.intersects.length) mouse.intersects = [];
  raycaster.intersectObjects(scene.children, false, mouse.intersects);

  raycaster.ray.intersectPlane(plane, world3);
  mouse.world.x = world3.x;
  mouse.world.y = world3.y;

  mouse.dispatchTypedEvent("mouseMove", new MouseMoveEvent());
});

globalThis.addEventListener("pointerdown", (event) =>
  mouse.dispatchTypedEvent(
    "mouseButtonDown",
    new MouseButtonEvent(
      "down",
      event.button === 0 ? "left" : event.button === 1 ? "middle" : "right",
    ),
  ));

globalThis.addEventListener("contextmenu", (e) => e.preventDefault());
