import { addSystem, appContext } from "@/shared/context.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { prefabs } from "@/shared/data.ts";
import { KdTree } from "@/shared/util/KDTree.ts";
import { Point } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";

// Dedicated KD-tree for flowers
const flowerKd = new KdTree();
const flowerToPoint = new Map<Entity, Point>();
const pointToFlower = new Map<Point, Entity>();

// Track which flowers have spawned bees
const flowersWithBees = new Set<Entity>();

// Track visited flowers per bee
const beeVisitedFlowers = new WeakMap<Entity, Set<Entity>>();

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
      flowersWithBees.delete(e);
    }
  },
});

const spawnBeeAtFlower = (flower: Entity) => {
  if (!flower.position) return;
  flowersWithBees.add(flower);

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
  const nearestPoint = flowerKd.nearest(
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
