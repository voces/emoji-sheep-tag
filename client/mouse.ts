import { TypedEventTarget } from "typed-event-target";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { camera, scene } from "./graphics/three.ts";
import { InstancedGroup } from "./graphics/InstancedGroup.ts";
import { app, Entity } from "./ecs.ts";
import { lookup } from "./systems/lookup.ts";

class MouseEvent extends Event {
  readonly pixels: Vector2;
  readonly percent: Vector2;
  readonly world: Vector2;
  readonly angle: number;
  readonly intersects: Set<Entity>;

  constructor(name: string) {
    super(name);

    this.pixels = mouse.pixels.clone();
    this.percent = mouse.percent.clone();
    this.world = mouse.world.clone();
    this.angle = mouse.angle;
    this.intersects = new Set(mouse.intersects);
  }
}

export class MouseButtonEvent extends MouseEvent {
  constructor(
    direction: "up" | "down",
    readonly button: "left" | "right" | "middle",
  ) {
    super(`mouseButton${direction[0].toUpperCase() + direction.slice(1)}`);
  }
}

export class MouseMoveEvent extends MouseEvent {
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
  intersects: Set<Entity>;
};

export const mouse: MouseEventTarget & Mouse = Object.assign(
  new MouseEventTarget(),
  {
    pixels: new Vector2(),
    percent: new Vector2(),
    world: new Vector2(),
    angle: 0,
    intersects: new Set<Entity>(),
  },
);

const raycaster = new Raycaster();

const cameraSpace = new Vector2();

const plane = new Plane(new Vector3(0, 0, 1), 0);

const world3 = new Vector3();

const updateIntersects = () => {
  const intersects = raycaster.intersectObjects(scene.children, true);
  if (intersects.length) {
    const set = new Set<Entity>();
    for (const intersect of intersects) {
      const parent = intersect.object.parent;
      if (
        !(parent instanceof InstancedGroup) ||
        typeof intersect.instanceId !== "number"
      ) continue;
      const id = parent.getId(intersect.instanceId);
      if (!id) continue;
      const entity = lookup[id];
      if (!entity || entity.blueprint) continue;
      set.add(entity);
    }
    if (set.size || mouse.intersects.size) mouse.intersects = set;
  } else if (mouse.intersects.size) mouse.intersects = new Set();

  raycaster.ray.intersectPlane(plane, world3);
  mouse.world.x = world3.x;
  mouse.world.y = world3.y;
};

globalThis.addEventListener("pointermove", (event) => {
  mouse.pixels.x = event.clientX;
  mouse.pixels.y = event.clientY;
  mouse.percent.x = event.clientX / window.innerWidth;
  mouse.percent.y = event.clientY / window.innerHeight;
  cameraSpace.x = mouse.percent.x * 2 - 1;
  cameraSpace.y = mouse.percent.y * -2 + 1;

  raycaster.setFromCamera(cameraSpace, camera);
  updateIntersects();

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

let counter = 0;
app.addSystem({ update: () => (counter++ % 15 === 0) && updateIntersects() });
