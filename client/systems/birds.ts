import { addSystem, appContext } from "@/shared/context.ts";
import { addEntity, removeEntity } from "@/shared/api/entity.ts";
import { prefabs } from "@/shared/data.ts";
import { Entity } from "../ecs.ts";

const trees = new Set<Entity>();

let nextSpawnTime = 0;
addSystem({
  props: ["targetedAs"],
  onAdd: (e) => e.targetedAs.includes("tree") && trees.add(e),
  onRemove: (e) => trees.delete(e),
  update: (delta: number) => {
    nextSpawnTime -= delta;

    if (nextSpawnTime <= 0) {
      spawnBird();
      nextSpawnTime = 1;
    }
  },
});

const spawnBird = () => {
  const treeArray = Array.from(trees).filter((e) => e.health && e.health > 0);

  if (treeArray.length < 2) return;

  // Pick random start tree
  const startTree = treeArray[Math.floor(Math.random() * treeArray.length)];
  if (!startTree.position) return;

  // Calculate distances to all other trees and bias towards nearby ones
  const remainingTrees = treeArray.filter((t) => t !== startTree && t.position);
  const treesWithDistances = remainingTrees.map((tree) => {
    const dx = tree.position!.x - startTree.position!.x;
    const dy = tree.position!.y - startTree.position!.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return { tree, distance };
  });

  // Sort by distance and use weighted random selection favoring closer trees
  treesWithDistances.sort((a, b) => a.distance - b.distance);

  // Use exponential distribution to bias towards closer trees
  // Random value between 0 and 1, squared to bias towards lower values
  const biasedRandom = Math.random() ** 5;
  const index = Math.floor(biasedRandom * treesWithDistances.length);
  const endTree = treesWithDistances[index]?.tree;

  if (!startTree.position || !endTree.position) return;

  const dx = endTree.position.x - startTree.position.x;
  const dy = endTree.position.y - startTree.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Calculate heading towards target
  const heading = Math.atan2(dy, dx);

  // Pick bird variant (60% bird1, 40% bird2)
  const isBird1 = Math.random() < 0.6;

  // Bird1: brighter, larger, slower
  // Bird2: less vibrant, smaller, faster
  // With overlapping ranges for variety

  const hue = Math.random();

  let saturation: number,
    lightness: number,
    speedMultiplier: number,
    scaleBase: number;

  if (isBird1) {
    // Bird1: higher saturation and lightness (brighter)
    saturation = 0.4 + Math.random() * 0.5; // 0.4-0.9
    lightness = 0.5 + Math.random() * 0.3; // 0.5-0.8
    speedMultiplier = 0.6 + Math.random() * 0.5; // slower: 0.6-1.1
    scaleBase = 0.5 + Math.random() * 0.4; // larger: 0.5-0.9
  } else {
    // Bird2: lower saturation and lightness (less vibrant)
    saturation = 0.2 + Math.random() * 0.4; // 0.2-0.6
    lightness = 0.35 + Math.random() * 0.3; // 0.35-0.65
    speedMultiplier = 0.9 + Math.random() * 0.6; // faster: 0.9-1.5
    scaleBase = 0.4 + Math.random() * 0.4; // smaller: 0.4-0.8
  }

  // Convert HSL to RGB
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs((hue * 6) % 2 - 1));
  const m = lightness - c / 2;
  let r = 0, g = 0, b = 0;

  if (hue < 1 / 6) [r, g, b] = [c, x, 0];
  else if (hue < 2 / 6) [r, g, b] = [x, c, 0];
  else if (hue < 3 / 6) [r, g, b] = [0, c, x];
  else if (hue < 4 / 6) [r, g, b] = [0, x, c];
  else if (hue < 5 / 6) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const red = Math.floor((r + m) * 255);
  const green = Math.floor((g + m) * 255);
  const blue = Math.floor((b + m) * 255);
  const color = (red << 16) | (green << 8) | blue;

  const movementSpeed = (prefabs.bird.movementSpeed ?? 2) * speedMultiplier;
  const modelScale = scaleBase;

  const bird = addEntity({
    prefab: "bird",
    model: isBird1 ? "bird1" : "bird2",
    position: { x: startTree.position.x, y: startTree.position.y },
    facing: heading,
    movementSpeed,
    modelScale,
    playerColor: `#${color.toString(16).padStart(6, "0")}`,
    order: {
      type: "walk",
      target: { x: endTree.position.x, y: endTree.position.y },
      path: [{ x: endTree.position.x, y: endTree.position.y }],
    },
    isEffect: true,
  });

  // Remove bird after it reaches destination
  const flightTime = distance / (bird.movementSpeed ?? 2);
  setTimeout(() => {
    if (appContext.current.entities.has(bird)) {
      removeEntity(bird);
    }
  }, flightTime * 1000);
};
