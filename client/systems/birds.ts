import { addSystem, appContext } from "@/shared/context.ts";
import { addEntity, removeEntity } from "@/shared/api/entity.ts";
import { prefabs } from "@/shared/data.ts";
import { normalizeAngle } from "@/shared/pathing/math.ts";
import { Entity } from "@/shared/types.ts";

// Track all living trees
const trees = new Set<Entity>();

// Track last time a bird chose to visit each tree
const treeLastVisitTime = new Map<Entity, number>();

// Track which bird belongs to which tree (one bird per tree)
const treeToBird = new Map<Entity, Entity>();

const treeOffsets = [
  { x: 0.2, y: 0.1 },
  { x: -0.18, y: 0 },
];

const getTreeLandingSpot = (tree: Entity) => {
  const offset = treeOffsets[Math.floor(Math.random() * treeOffsets.length)];
  const scale = tree.modelScale ?? 1;
  const facing = normalizeAngle(tree.facing ?? 0);
  const flip = facing < (Math.PI / 2) && facing > (Math.PI / -2);
  const angle = flip ? Math.PI - facing : facing + Math.PI;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const oy = flip ? -offset.y : offset.y;
  return {
    x: tree.position!.x + (offset.x * cos - oy * sin) * scale,
    y: tree.position!.y + (offset.x * sin + oy * cos) * scale,
  };
};

addSystem({
  props: ["targetedAs", "position"] as const,
  onAdd: (e) => {
    if (e.targetedAs?.includes("tree") && e.position) {
      trees.add(e);
      treeLastVisitTime.set(e, 0);

      if (Math.random() < 0.35) spawnBirdAtTree(e);
    }
  },
  onRemove: (e) => {
    if (e.targetedAs?.includes("tree")) {
      trees.delete(e);
      treeLastVisitTime.delete(e);

      const bird = treeToBird.get(e);
      if (bird) {
        removeEntity(bird);
        treeToBird.delete(e);
      }
    }
  },
});

const spawnBirdAtTree = (tree: Entity) => {
  if (!tree.position) return;
  if (treeToBird.has(tree)) return; // Already has a bird

  // Pick bird variant (60% bird1, 40% bird2)
  const isBird1 = Math.random() < 0.6;

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

  const bird = addEntity({
    prefab: "bird",
    model: isBird1 ? "bird1" : "bird2",
    position: getTreeLandingSpot(tree),
    facing: Math.random() < 0.5 ? 0 : Math.PI,
    movementSpeed: (prefabs.bird.movementSpeed ?? 2) * speedMultiplier,
    modelScale: scaleBase,
    playerColor: `#${color.toString(16).padStart(6, "0")}`,
    isEffect: true,
  });

  treeToBird.set(tree, bird);

  // Start looking for next tree after a short rest
  const restTime = 2 + Math.random() * 5;
  setTimeout(() => scheduleNextTreeVisit(bird), restTime * 1000);
};

const selectTargetTree = (bird: Entity): Entity | null => {
  if (!bird.position) return null;

  // Get living trees (have health > 0)
  const livingTrees = Array.from(trees).filter((t) =>
    t.health && t.health > 0 && t.position
  );
  if (livingTrees.length === 0) return null;

  // Randomly sample up to 8 trees
  const sampleSize = Math.min(8, livingTrees.length);
  const sampled: Entity[] = [];
  const indices = new Set<number>();

  while (sampled.length < sampleSize) {
    const idx = Math.floor(Math.random() * livingTrees.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      sampled.push(livingTrees[idx]);
    }
  }

  const now = performance.now() / 1000;

  // Calculate sqrt group for each sampled tree and distance
  const treesWithInfo = sampled.map((tree) => {
    const lastVisit = treeLastVisitTime.get(tree) ?? 0;
    const delta = now - lastVisit;
    const cbrtGroup = Math.floor(Math.cbrt(delta));

    const dx = tree.position!.x - bird.position!.x;
    const dy = tree.position!.y - bird.position!.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return { tree, cbrtGroup, distance };
  });

  // Sort by sqrtGroup descending, then by distance ascending
  treesWithInfo.sort((a, b) => {
    if (b.cbrtGroup !== a.cbrtGroup) return b.cbrtGroup - a.cbrtGroup;
    return a.distance - b.distance;
  });

  // Pick the highest group
  const highestGroup = treesWithInfo[0].cbrtGroup;
  const inHighestGroup = treesWithInfo.filter((t) =>
    t.cbrtGroup === highestGroup
  );

  // Pick the closest tree in that group (already sorted by distance)
  return inHighestGroup[0].tree;
};

const scheduleNextTreeVisit = (bird: Entity) => {
  if (!appContext.current.entities.has(bird) || !bird.position) return;

  const targetTree = selectTargetTree(bird);
  if (!targetTree?.position) return;

  // Mark this tree as being visited now (when bird starts flying)
  treeLastVisitTime.set(targetTree, performance.now() / 1000);

  const target = getTreeLandingSpot(targetTree);

  const dx = target.x - bird.position.x;
  const dy = target.y - bird.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const heading = Math.atan2(dy, dx);

  // Update bird to fly to this tree
  bird.facing = heading;
  bird.order = { type: "walk", target, path: [target] };

  // Schedule arrival and next visit
  const flightTime = distance / (bird.movementSpeed ?? 2);
  const restTime = 2 + Math.random() * 5;

  // When bird arrives, face 0 or π (whichever requires least turning)
  setTimeout(() => {
    if (!appContext.current.entities.has(bird)) return;
    const currentFacing = bird.facing ?? 0;
    // Calculate angular distance to 0 and π
    const distTo0 = Math.abs(
      Math.atan2(Math.sin(currentFacing), Math.cos(currentFacing)),
    );
    const distToPi = Math.abs(
      Math.atan2(
        Math.sin(currentFacing - Math.PI),
        Math.cos(currentFacing - Math.PI),
      ),
    );
    bird.facing = distTo0 <= distToPi ? 0 : Math.PI;
  }, flightTime * 1000);

  setTimeout(() => {
    scheduleNextTreeVisit(bird);
  }, (flightTime + restTime) * 1000);
};
