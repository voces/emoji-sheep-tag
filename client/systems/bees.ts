import { addSystem, appContext } from "@/shared/context.ts";
import { addEntity, removeEntity } from "@/shared/api/entity.ts";
import { prefabs } from "@/shared/data.ts";
import { KdTree } from "@/shared/util/KDTree.ts";
import { normalizeAngle, Point } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";

// Dedicated KD-tree for flowers
const flowerKd = new KdTree();
const flowerToPoint = new Map<Entity, Point>();
const pointToFlower = new Map<Point, Entity>();

// Track visited flowers per bee
const beeVisitedFlowers = new WeakMap<Entity, Set<Entity>>();

// Track which bee belongs to which flower (one bee per flower)
const flowerToBee = new Map<Entity, Entity>();

const flowerOffsets = [
  { x: -0.0086, y: -0.0109 },
  { x: -0.0833, y: 0.0788 },
  { x: 0.0546, y: 0.0588 },
];

addSystem({
  props: ["prefab", "position"] as const,
  onAdd: (e) => {
    if (e.prefab === "flowers" && e.position) {
      flowerKd.add(e.position);
      flowerToPoint.set(e, e.position);
      pointToFlower.set(e.position, e);

      if (Math.random() < 0.10) spawnBeeAtFlower(e);
    }
  },
  onRemove: (e) => {
    if (e.prefab === "flowers") {
      const point = flowerToPoint.get(e);
      if (point) {
        flowerKd.delete(point);
        flowerToPoint.delete(e);
        pointToFlower.delete(point);
      }

      const bee = flowerToBee.get(e);
      if (bee) {
        removeEntity(bee);
        flowerToBee.delete(e);
      }
    }
  },
});

const spawnBeeAtFlower = (flower: Entity) => {
  if (!flower.position) return;
  if (flowerToBee.has(flower)) return; // Already has a bee

  const movementSpeed = (prefabs.bee.movementSpeed ?? 1.5) *
    (0.8 + Math.random() * 0.4);

  const modelScale = 0.25 + Math.random() * 0.15;

  const bee = addEntity({
    prefab: "bee",
    position: { x: flower.position.x, y: flower.position.y },
    facing: Math.random() * Math.PI * 2,
    movementSpeed,
    modelScale,
    isEffect: true,
  });

  flowerToBee.set(flower, bee);

  // Initialize visited set with starting flower
  const visitedFlowers = new Set<Entity>([flower]);
  beeVisitedFlowers.set(bee, visitedFlowers);

  // Start looking for next flower
  scheduleNextFlowerVisit(bee);
};

const scheduleNextFlowerVisit = (bee: Entity) => {
  if (!appContext.current.entities.has(bee) || !bee.position) return;

  const visitedFlowers = beeVisitedFlowers.get(bee);
  if (!visitedFlowers) return;

  // Find nearest unvisited flower
  let nearestPoint = flowerKd.nearest(
    bee.position.x,
    bee.position.y,
    (point: Point) => {
      const flower = pointToFlower.get(point);
      return flower
        ? !visitedFlowers.has(flower) && Math.random() < 0.5
        : false;
    },
  );

  if (!nearestPoint) {
    // No unvisited flowers found, reset visited set and try again
    visitedFlowers.clear();
    const anyFlower = flowerKd.nearest(
      bee.position.x,
      bee.position.y,
      () => true,
    );
    if (!anyFlower) return; // No flowers at all

    const flower = pointToFlower.get(anyFlower);
    if (flower) visitedFlowers.add(flower);
  } else {
    const targetFlower = pointToFlower.get(nearestPoint);
    if (!targetFlower) return;

    visitedFlowers.add(targetFlower);

    const offset =
      flowerOffsets[Math.floor(Math.random() * flowerOffsets.length)];
    const scale = targetFlower.modelScale ?? 1;
    const facing = normalizeAngle(targetFlower.facing ?? 0);
    const flip = facing < (Math.PI / 2) && facing > (Math.PI / -2);
    const angle = flip ? Math.PI - facing : facing + Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const oy = flip ? -offset.y : offset.y;
    nearestPoint = {
      x: nearestPoint.x + (offset.x * cos - oy * sin) * scale,
      y: nearestPoint.y + (offset.x * sin + oy * cos) * scale,
    };

    const dx = nearestPoint.x - bee.position.x;
    const dy = nearestPoint.y - bee.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const heading = Math.atan2(dy, dx);

    // Update bee to fly to this flower
    bee.facing = heading;
    bee.order = {
      type: "walk",
      target: { x: nearestPoint.x, y: nearestPoint.y },
      path: [{ x: nearestPoint.x, y: nearestPoint.y }],
    };

    // Schedule next visit after reaching this flower
    const flightTime = distance / (bee.movementSpeed ?? 1.5);
    const hoverTime = 0.125 + Math.random() ** 2 * 4.875;
    setTimeout(() => {
      scheduleNextFlowerVisit(bee);
    }, (flightTime + hoverTime) * 1000);
  }
};
