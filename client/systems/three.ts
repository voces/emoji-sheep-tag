import { Color } from "three";

import { app, Entity, SystemEntity } from "../ecs.ts";
import { InstancedGroup } from "../graphics/InstancedGroup.ts";
import { loadSvg } from "../graphics/loadSvg.ts";
import { getLocalPlayer } from "../api/player.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { getFps } from "../graphics/three.ts";
import { computeUnitMovementSpeed, isAlly } from "@/shared/api/unit.ts";
import { addSystem, appContext } from "@/shared/context.ts";
import { glow } from "../graphics/glow.ts";

import sheep from "../assets/sheep.svg" with { type: "text" };
import wolf from "../assets/wolf.svg" with { type: "text" };
import hut from "../assets/hut.svg" with { type: "text" };
import fence from "../assets/fence.svg" with { type: "text" };
import fire from "../assets/fire.svg" with { type: "text" };
import claw from "../assets/claw.svg" with { type: "text" };
import claw2 from "../assets/claw2.svg" with { type: "text" };
import collision from "../assets/collision.svg" with { type: "text" };
import flowers from "../assets/flowers.svg" with { type: "text" };
import grass from "../assets/grass.svg" with { type: "text" };
import suspend from "../assets/suspend.svg" with { type: "text" };
import circle from "../assets/circle.svg" with { type: "text" };
import gravity from "../assets/gravity.svg" with { type: "text" };
import hinduTemple from "../assets/hindu-temple.svg" with { type: "text" };
import route from "../assets/route.svg" with { type: "text" };
import stop from "../assets/stop.svg" with { type: "text" };
import gold from "../assets/gold.svg" with { type: "text" };
import divinity from "../assets/divinity.svg" with { type: "text" };
import shop from "../assets/shop.svg" with { type: "text" };
import fox from "../assets/fox.svg" with { type: "text" };
import sapphire from "../assets/sapphire.svg" with { type: "text" };
import runningShoes from "../assets/running-shoes.svg" with { type: "text" };
import purplePotion from "../assets/purple-potion.svg" with { type: "text" };
import meteor from "../assets/meteor.svg" with { type: "text" };
import dash from "../assets/dash.svg" with { type: "text" };
import tree from "../assets/tree.svg" with { type: "text" };
import treeStump from "../assets/treeStump.svg" with { type: "text" };
import flag from "../assets/flag.svg" with { type: "text" };
import square from "../assets/square.svg" with { type: "text" };
import pinkPotion from "../assets/pinkPotion.svg" with { type: "text" };
import rock from "../assets/rock.svg" with { type: "text" };
import house from "../assets/house.svg" with { type: "text" };
import atom from "../assets/atom.svg" with { type: "text" };
import ramp from "../assets/ramp.svg" with { type: "text" };
import raise from "../assets/raise.svg" with { type: "text" };
import lower from "../assets/lower.svg" with { type: "text" };
import left from "../assets/left.svg" with { type: "text" };
import right from "../assets/right.svg" with { type: "text" };
import up from "../assets/up.svg" with { type: "text" };
import down from "../assets/down.svg" with { type: "text" };
import location from "../assets/location.svg" with { type: "text" };
import well from "../assets/well.svg" with { type: "text" };
import windmill from "../assets/windmill.svg" with { type: "text" };
import scarecrow from "../assets/scarecrow.svg" with { type: "text" };
// import tractor from "../assets/tractor.svg" with { type: "text" };
import derelictHouse from "../assets/derelictHouse.svg" with { type: "text" };
import barrel from "../assets/barrel.svg" with { type: "text" };
import hayBale from "../assets/hayBale.svg" with { type: "text" };
import wood from "../assets/wood.svg" with { type: "text" };
import bluePotion from "../assets/blue-potion.svg" with { type: "text" };
import sentry from "../assets/sentry.svg" with { type: "text" };
import watchtower from "../assets/watchtower.svg" with { type: "text" };
import bite from "../assets/bite.svg" with { type: "text" };
import castle from "../assets/castle.svg" with { type: "text" };
import frostOrb from "../assets/frostOrb.svg" with { type: "text" };
import sword from "../assets/sword.svg" with { type: "text" };
import attackGround from "../assets/attackGround.svg" with { type: "text" };
import totem from "../assets/totem.svg" with { type: "text" };
import shield from "../assets/shield.svg" with { type: "text" };
import wind from "../assets/wind.svg" with { type: "text" };
import sparkle from "../assets/sparkle.svg" with { type: "text" };
import rune from "../assets/rune.svg" with { type: "text" };
import rune2 from "../assets/rune2.svg" with { type: "text" };
import swap from "../assets/swap.svg" with { type: "text" };
import scythe from "../assets/scythe.svg" with { type: "text" };
import fangs from "../assets/fangs.svg" with { type: "text" };
import direCollar from "../assets/direCollar.svg" with { type: "text" };
import crimsonArc from "../assets/crimsonArc.svg" with { type: "text" };
import pause from "../assets/pause.svg" with { type: "text" };
import cancel from "../assets/cancel.svg" with { type: "text" };
import vip from "../assets/vip.svg" with { type: "text" };
import wolfDodge from "../assets/wolf-dodge.svg" with { type: "text" };
import construction from "../assets/construction.svg" with { type: "text" };
import bird1 from "../assets/bird1.svg" with { type: "text" };
import bird2 from "../assets/bird2.svg" with { type: "text" };
import bee from "../assets/bee.svg" with { type: "text" };

export const svgs: Record<string, string> = {
  sheep,
  wolf,
  hut,
  fence,
  fire,
  claw,
  collision,
  flowers,
  grass,
  circle,
  gravity,
  suspend,
  hinduTemple,
  route,
  stop,
  gold,
  divinity,
  shop,
  claw2,
  fox,
  sapphire,
  runningShoes,
  purplePotion,
  meteor,
  dash,
  tree,
  treeStump,
  flag,
  square,
  pinkPotion,
  rock,
  house,
  atom,
  ramp,
  raise,
  lower,
  left,
  right,
  up,
  down,
  location,
  well,
  windmill,
  scarecrow,
  // tractor,
  derelictHouse,
  barrel,
  hayBale,
  wood,
  bluePotion,
  sentry,
  watchtower,
  bite,
  castle,
  sword,
  attackGround,
  totem,
  shield,
  wind,
  rune,
  rune2,
  swap,
  scythe,
  fangs,
  direCollar,
  pause,
  cancel,
  vip,
  wolfDodge,
  construction,
};

type SvgConfig = {
  svg: string;
  scale: number;
  options?: Parameters<typeof loadSvg>[2];
};

const svg = (
  svgText: string,
  scale: number,
  options?: Parameters<typeof loadSvg>[2],
): SvgConfig => ({ svg: svgText, scale, options });

const svgConfigs: Record<string, SvgConfig | InstancedGroup> = {
  // Background elements (lowest z-order)
  flowers: svg(flowers, 0.25, { layer: 2 }),
  grass: svg(grass, 0.75, { layer: 2 }),
  treeStump: svg(treeStump, 0.11, {
    layer: 2,
    yOffset: -0.36,
    xOffset: -0.01,
  }),
  rock: svg(rock, 0.6, { layer: 2 }),
  fence: svg(fence, 0.07, { layer: 2 }),
  well: svg(well, 0.13, { layer: 2 }),
  scarecrow: svg(scarecrow, 0.14, { layer: 2 }),
  derelictHouse: svg(derelictHouse, 3.5, { layer: 2 }),
  barrel: svg(barrel, 0.14, { layer: 2 }),
  hayBale: svg(hayBale, 0.31, { layer: 2, xOffset: -0.05, yOffset: -0.1 }),
  wood: svg(wood, 0.12, { layer: 2 }),
  // tractor: loadSvg(tractor, 1, { layer: 2 }),

  // Bottom-layer indicators (render between background elements and units)
  circleBottom: svg(circle, 0.08, { layer: 2 }),
  gravityBottom: svg(gravity, 2, { layer: 2 }),
  glow,

  // Basic units and structures
  sentry: svg(sentry, 0.03),
  sheep: svg(sheep, 1),
  hut: svg(hut, 2),
  house: svg(house, 3.4),
  watchtower: svg(watchtower, 0.06),
  divinity: svg(divinity, 1),
  castle: svg(castle, 0.7),
  // shop: loadSvg(shop, 1),
  fox: svg(fox, 1.8),
  wolf: svg(wolf, 2),
  atom: svg(atom, 0.05),

  // Trees (should render in front of structures)
  windmill: svg(windmill, 0.24, { layer: 2, yOffset: 0.1, xOffset: -0.1 }),
  tree: svg(tree, 0.11, { layer: 2, yOffset: 0.2 }),
  totem: svg(totem, 0.18, { yOffset: 0.12 }),

  // Temple stacks on things, we want it visible, always
  hinduTemple: svg(hinduTemple, 1.75),

  bird1: svg(bird1, 0.25, { layer: 2 }),
  bird2: svg(bird2, 0.25, { layer: 2 }),
  bee: svg(bee, 0.17, { layer: 2 }),

  // SFX elements (highest z-order, always on top)
  shield: svg(shield, 1, { layer: 2 }),
  wind: svg(wind, 1, { layer: 2 }),
  sparkle: svg(sparkle, 1, { layer: 2 }),
  rune: svg(rune, 0.4, { layer: 2 }),
  rune2: svg(rune2, 0.05, { layer: 2 }),
  swap: svg(swap, 0.1, { layer: 2 }),
  fire: svg(fire, 1, { layer: 2 }),
  crimsonArc: svg(crimsonArc, 0.1, { layer: 2 }),
  vip: svg(vip, 0.03, { layer: 2 }),
  claw: svg(claw, 0.05, { layer: 2 }),
  dash: svg(dash, 0.1, { layer: 2 }),
  flag: svg(flag, 1, { layer: 2, yOffset: 0.15, xOffset: 0.09 }),
  location: svg(location, 2, { layer: 2 }),
  collision: svg(collision, 2, { layer: 2 }),
  meteor: svg(meteor, 0.5, { layer: 2 }),
  frostOrb: svg(frostOrb, 0.4, { layer: 2 }),
  square: svg(square, 1, { layer: 2 }),

  // Top-layer indicators (render above everything)
  circle: svg(circle, 0.08, { layer: 2 }),
  gravity: svg(gravity, 2, { layer: 2 }),
};

const getCollection = (model: string): InstancedGroup | undefined => {
  const config = svgConfigs[model];
  if (!config) return undefined;
  if (config instanceof InstancedGroup) return config;

  const group = loadSvg(config.svg, config.scale, config.options);
  svgConfigs[model] = group;
  return group;
};

const collections: Record<string, InstancedGroup | undefined> = new Proxy(
  {} as Record<string, InstancedGroup | undefined>,
  {
    get: (_target, prop: string) => getCollection(prop),
  },
);
Object.assign(globalThis, { collections });

const isVisibleToLocalPlayer = (e: Entity) => {
  if (e.hiddenByFog) return false;
  if (!e.teamScoped) return true;
  const l = getLocalPlayer()?.id;
  if (!l) return true;
  return isAlly(e, l);
};

const color = new Color();

const updateColor = (e: Entity) => {
  if (!appContext.current.entities.has(e)) return;
  const model = e.model ?? e.prefab;
  if (!model) return;
  const collection = collections[model];
  if (!collection) return;

  if (typeof e.vertexColor === "number") {
    color.setHex(e.vertexColor);
    collection.setVertexColorAt(e.id, color);
  } else {
    color.setHex(0xffffff);
    collection.setVertexColorAt(e.id, color);
  }

  const accentColor = e.playerColor ?? getPlayer(e.owner)?.playerColor;

  if (accentColor) {
    collection.setPlayerColorAt(e.id, color.set(accentColor ?? 0xffffff));
  }

  if (e.alpha) collection.setAlphaAt(e.id, e.alpha, false);
  else if (e.progress) collection.setAlphaAt(e.id, e.progress, true);
  else collection.setAlphaAt(e.id, 1);
};

addSystem({
  props: ["owner"],
  onAdd: updateColor,
  onChange: updateColor,
  onRemove: updateColor,
});

addSystem({
  props: ["vertexColor"],
  onAdd: updateColor,
  onChange: updateColor,
  onRemove: updateColor,
});

addSystem({
  props: ["alpha"],
  onAdd: updateColor,
  onChange: updateColor,
  onRemove: updateColor,
});

addSystem({
  props: ["playerColor"],
  onAdd: updateColor,
  onChange: updateColor,
  onRemove: updateColor,
});

const prevPositions = new WeakMap<Entity, Entity["position"]>();
const gaitProgress = new WeakMap<Entity, number>();
const pathStartPositions = new WeakMap<Entity, { x: number; y: number }>();

const onPositionOrRotationChange = (
  e: SystemEntity<"position"> & {
    readonly facing?: number | null;
  },
) => {
  const model = e.model ?? e.prefab;
  if (!model) return;

  if (!isVisibleToLocalPlayer(e)) {
    return collections[model]?.setPositionAt(
      e.id,
      Infinity,
      Infinity,
      e.facing,
      e.zIndex,
    );
  }

  let baseX = e.position.x;
  let baseY = e.position.y;

  if (e.order && "path" in e.order) {
    const prev = prevPositions.get(e);
    if (prev) {
      const delta =
        ((prev.x - e.position.x) ** 2 + (prev.y - e.position.y) ** 2) ** 0.5;
      const movement = computeUnitMovementSpeed(e) / getFps();
      const jerk = delta / movement;

      if (jerk > 1.05 && jerk < 15) {
        const angle = Math.atan2(
          e.position.y - prev.y,
          e.position.x - prev.x,
        );
        const dist = movement * 1.05;
        baseX = prev.x + dist * Math.cos(angle);
        baseY = prev.y + dist * Math.sin(angle);
        prevPositions.set(e, { x: baseX, y: baseY });
      } else {
        prevPositions.set(e, e.position);
      }
    } else {
      prevPositions.set(e, e.position);
    }
  } else {
    prevPositions.set(e, e.position);
  }

  let finalX = baseX;
  let finalY = baseY;

  if (e.gait && e.order && "path" in e.order && e.movementSpeed) {
    const path = e.order.path;
    if (!path || path.length === 0) {
      gaitProgress.delete(e);
      pathStartPositions.delete(e);
    } else {
      if (!pathStartPositions.has(e)) {
        pathStartPositions.set(e, { x: e.position.x, y: e.position.y });
      }

      const dt = 1 / getFps();
      const currentProgress = gaitProgress.get(e) ?? 0;
      const newProgress = (currentProgress + dt) % e.gait.duration;
      gaitProgress.set(e, newProgress);

      const t = (newProgress / e.gait.duration) * Math.PI * 2;
      const distancePerCycle = e.movementSpeed * e.gait.duration;

      let offsetX = 0;
      let offsetY = 0;

      for (const component of e.gait.components) {
        const angle = component.frequency * t + component.phase;
        offsetX += component.radiusX * distancePerCycle * Math.cos(angle);
        offsetY += component.radiusY * distancePerCycle * Math.sin(angle);
      }

      const fadeDistance = 0.5;
      const startPos = pathStartPositions.get(e)!;
      const distFromStart = ((e.position.x - startPos.x) ** 2 +
        (e.position.y - startPos.y) ** 2) ** 0.5;
      const endPos = path[path.length - 1];
      const distToEnd = ((e.position.x - endPos.x) ** 2 +
        (e.position.y - endPos.y) ** 2) ** 0.5;

      const fadeInMultiplier = Math.min(1, distFromStart / fadeDistance);
      const fadeOutMultiplier = Math.min(1, distToEnd / fadeDistance);
      const fadeMultiplier = Math.min(fadeInMultiplier, fadeOutMultiplier);

      offsetX *= fadeMultiplier;
      offsetY *= fadeMultiplier;

      const heading = e.facing ?? 0;
      const cos = Math.cos(heading);
      const sin = Math.sin(heading);

      finalX = baseX + offsetX * cos - offsetY * sin;
      finalY = baseY + offsetX * sin + offsetY * cos;
    }
  } else {
    gaitProgress.delete(e);
    pathStartPositions.delete(e);
  }

  collections[model]?.setPositionAt(
    e.id,
    finalX,
    finalY,
    e.facing,
    e.zIndex,
  );
};

const handleFog = (e: Entity) =>
  e.position && onPositionOrRotationChange(e as SystemEntity<"position">);
addSystem({
  props: ["hiddenByFog"],
  onAdd: handleFog,
  onChange: handleFog,
  onRemove: handleFog,
});

addSystem({
  props: ["facing"],
  onChange: (e) => {
    if (e.position) {
      onPositionOrRotationChange(
        e as SystemEntity<"position" | "facing">,
      );
    }
  },
});

const updateScale = (e: Entity) => {
  if (!appContext.current.entities.has(e)) return;
  const model = e.model ?? e.prefab;
  if (!model) return;
  const collection = collections[model];
  if (!collection) return console.warn(`No ${e.model} SVG on ${e.id}`);
  collection.setScaleAt(e.id, e.modelScale ?? 1, e.aspectRatio);
};
addSystem({
  props: ["modelScale"],
  onAdd: updateScale,
  onChange: updateScale,
  onRemove: updateScale,
});
addSystem({
  props: ["aspectRatio"],
  onAdd: updateScale,
  onChange: updateScale,
  onRemove: updateScale,
});

addSystem({
  props: ["progress", "completionTime"],
  updateEntity: (e, delta) => {
    if (e.progress + delta >= 1) {
      return delete (e as Entity).progress;
    }
    e.progress += delta / e.completionTime;
  },
});

const updateAlpha = (e: Entity) => {
  if (!appContext.current.entities.has(e)) return;
  const collection = collections[e.model ?? e.prefab ?? ""];
  if (!collection) return;
  collection.setAlphaAt(
    e.id,
    typeof e.progress === "number" ? e.progress : 1,
    typeof e.progress === "number",
  );
};
addSystem({
  props: ["progress"],
  onAdd: updateAlpha,
  onChange: updateAlpha,
  onRemove: updateAlpha,
});

const wasCastingMirror = new Map<Entity, number>();

addSystem<Entity, "order" | "position">({
  props: ["order", "position"],
  onChange: (e) => {
    if (e.order.type === "cast" && e.order.orderId === "mirrorImage") {
      wasCastingMirror.set(e, e.order.remaining + 0.15);
    }
  },
  updateEntity: (e) => {
    const model = e.model ?? e.prefab;
    if (
      !model || e.order.type !== "cast" || "path" in e.order ||
      e.order.remaining === 0
    ) return;

    if (!isVisibleToLocalPlayer(e)) {
      return collections[model]?.setPositionAt(
        e.id,
        Infinity,
        Infinity,
        e.facing,
        e.zIndex,
      );
    }

    const r = Math.random() * Math.PI * 2;
    collections[model]?.setPositionAt(
      e.id,
      e.position.x + 0.05 * Math.cos(r),
      e.position.y + 0.05 * Math.sin(r),
      e.facing,
      e.zIndex,
    );
  },
  update: (delta) => {
    for (const [e, remaining] of wasCastingMirror) {
      const model = e.model ?? e.prefab;
      if (!model || !e.position || !app.entities.has(e)) {
        wasCastingMirror.delete(e);
        continue;
      }

      if (!isVisibleToLocalPlayer(e)) {
        collections[model]?.setPositionAt(
          e.id,
          Infinity,
          Infinity,
          e.facing,
          e.zIndex,
        );
        wasCastingMirror.delete(e);
        continue;
      }

      if ((remaining ?? 0) < delta) wasCastingMirror.delete(e);
      else wasCastingMirror.set(e, remaining - delta);

      const r = Math.random() * Math.PI * 2;
      collections[model]?.setPositionAt(
        e.id,
        e.position.x + 0.05 * Math.cos(r),
        e.position.y + 0.05 * Math.sin(r),
        e.facing,
        e.zIndex,
      );
    }
  },
});

// Reflect logical position to render position
addSystem({
  props: ["position"],
  onAdd: (e) => {
    prevPositions.set(e, e.position);
    const model = e.model ?? e.prefab;
    if (!model) return;
    if (!collections[model]) {
      return console.warn(`No ${e.model} SVG on ${e.id}`);
    }

    if (!isVisibleToLocalPlayer(e)) {
      return collections[model]?.setPositionAt(
        e.id,
        Infinity,
        Infinity,
        e.facing,
        e.zIndex,
      );
    }

    collections[model]?.setPositionAt(
      e.id,
      e.position.x,
      e.position.y,
      e.facing,
      e.zIndex,
    );
  },
  onChange: onPositionOrRotationChange,
  onRemove: (e) => collections[e.model ?? e.prefab!]?.delete(e.id),
});

const prevModel = new WeakMap<Entity, string>();
addSystem({
  props: ["prefab"],
  onAdd: (e) => {
    const collection = e.model ?? e.prefab;
    if (collection) prevModel.set(e, collection);
  },
  onChange: (e) => {
    const next = e.model ?? e.prefab;
    const prev = prevModel.get(e);
    if (prev !== next) {
      collections[prev ?? ""]?.delete(e.id);
      prevModel.set(e, next);
      if (e.position) onPositionOrRotationChange(e as SystemEntity<"position">);
    }
  },
  onRemove: (e) => {
    const collection = e.model ?? e.prefab;
    if (!collection) prevModel.delete(e);
  },
});
addSystem({
  props: ["model"],
  onAdd: (e) => {
    const collection = e.model ?? e.prefab;
    if (collection) prevModel.set(e, collection);
  },
  onChange: (e) => {
    const next = e.model ?? e.prefab;
    const prev = prevModel.get(e);
    if (prev !== next) {
      collections[prev ?? ""]?.delete(e.id);
      prevModel.set(e, next);
      if (e.position) onPositionOrRotationChange(e as SystemEntity<"position">);
    }
  },
  onRemove: (e) => {
    const collection = e.model ?? e.prefab;
    if (!collection) prevModel.delete(e);
  },
});

const minimapColor = new Color();
const savedColors = new Map<string, Array<Color | null>>();

export const setMinimapMask = (entity: Entity, mask: boolean) => {
  const collection = entity.model ?? entity.prefab;
  if (!collection) return;
  const group = collections[collection];
  if (!group) return;

  group.setMinimapMaskAt(entity.id, mask ? 1 : 0);

  const playerColor = entity.playerColor ??
    getPlayer(entity.owner)?.playerColor;
  if (!playerColor) return;

  if (mask) {
    savedColors.set(entity.id, group.saveInstanceColors(entity.id));
    group.setVertexColorAt(entity.id, minimapColor.set(playerColor));
  } else {
    const colorArray = savedColors.get(entity.id);
    if (colorArray) {
      group.restoreInstanceColors(entity.id, colorArray);
      savedColors.delete(entity.id);
    }
  }
};

export const clearMinimapMaskCache = () => {
  savedColors.clear();
};
