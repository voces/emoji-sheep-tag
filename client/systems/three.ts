import { Color } from "three";

import { app, Entity, SystemEntity } from "../ecs.ts";
import { InstancedGroup } from "../graphics/InstancedGroup.ts";
import { loadSvg } from "../graphics/loadSvg.ts";
import { getLocalPlayer, playersVar } from "@/vars/players.ts";
import { getFps } from "../graphics/three.ts";
import { computeUnitMovementSpeed, isAlly } from "@/shared/api/unit.ts";

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
// import atom from "../assets/atom.svg" with { type: "text" };
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
  // atom,
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
};

const collections: Record<string, InstancedGroup | undefined> = {
  // Background elements (lowest z-order)
  flowers: loadSvg(flowers, 0.25, { layer: 2 }),
  grass: loadSvg(grass, 0.75, { layer: 2 }),
  treeStump: loadSvg(treeStump, 0.11, {
    layer: 2,
    yOffset: -0.36,
    xOffset: -0.01,
  }),
  rock: loadSvg(rock, 0.6, { layer: 2 }),
  fence: loadSvg(fence, 0.07, { layer: 2 }),
  well: loadSvg(well, 0.13, { layer: 2 }),
  scarecrow: loadSvg(scarecrow, 0.14, { layer: 2 }),
  derelictHouse: loadSvg(derelictHouse, 3.5, { layer: 2 }),
  barrel: loadSvg(barrel, 0.14, { layer: 2 }),
  hayBale: loadSvg(hayBale, 0.31, { layer: 2, xOffset: -0.05, yOffset: -0.1 }),
  wood: loadSvg(wood, 0.12, { layer: 2 }),
  // tractor: loadSvg(tractor, 1, { layer: 2 }),

  // Basic units and structures
  sheep: loadSvg(sheep, 1),
  hut: loadSvg(hut, 2),
  house: loadSvg(house, 3.4),
  divinity: loadSvg(divinity, 1),
  // shop: loadSvg(shop, 1),
  fox: loadSvg(fox, 1.8),
  wolf: loadSvg(wolf, 2),
  // atom: loadSvg(atom, 0.05),

  // Trees (should render in front of structures)
  windmill: loadSvg(windmill, 0.24, { layer: 2, yOffset: 0.1, xOffset: -0.1 }),
  tree: loadSvg(tree, 0.11, { layer: 2, yOffset: 0.2 }),

  // Temple stacks on things, we want it visible, always
  hinduTemple: loadSvg(hinduTemple, 1.75),

  // SFX elements (highest z-order, always on top)
  fire: loadSvg(fire, 1, { layer: 2 }),
  claw: loadSvg(claw, 0.05, { layer: 2 }),
  dash: loadSvg(dash, 0.1, { layer: 2 }),
  flag: loadSvg(flag, 1, { layer: 2, yOffset: 0.15, xOffset: 0.09 }),
  location: loadSvg(location, 2, { layer: 2 }),
  circle: loadSvg(circle, 0.08, { layer: 2 }),
  gravity: loadSvg(gravity, 2, { layer: 2 }),
  collision: loadSvg(collision, 2, { layer: 2 }),
  meteor: loadSvg(meteor, 0.5, { layer: 2 }),
  square: loadSvg(square, 1, { layer: 2 }),
};
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
  if (!app.entities.has(e)) return;
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

  const accentColor = e.playerColor ??
    playersVar().find((p) => p.id === e.owner)?.color;

  if (accentColor) {
    collection.setPlayerColorAt(e.id, color.set(accentColor ?? 0xffffff));
  }

  // TODO: merge these
  if (e.alpha) collection.setAlphaAt(e.id, e.alpha, false);
  else if (e.progress) collection.setAlphaAt(e.id, e.progress, true);
  else collection.setAlphaAt(e.id, 1);
};

app.addSystem({
  props: ["owner"],
  onAdd: updateColor,
  onChange: updateColor,
  onRemove: updateColor,
});

app.addSystem({
  props: ["vertexColor"],
  onAdd: updateColor,
  onChange: updateColor,
  onRemove: updateColor,
});

app.addSystem({
  props: ["alpha"],
  onAdd: updateColor,
  onChange: updateColor,
  onRemove: updateColor,
});

app.addSystem({
  props: ["playerColor"],
  onAdd: updateColor,
  onChange: updateColor,
  onRemove: updateColor,
});

const prevPositions = new WeakMap<Entity, Entity["position"]>();

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
        const x = prev.x + dist * Math.cos(angle);
        const y = prev.y + dist * Math.sin(angle);
        collections[model]?.setPositionAt(
          e.id,
          x,
          y,
          e.facing,
          e.zIndex,
        );
        prevPositions.set(e, { x, y });
        return;
      }
    }
  }
  collections[model]?.setPositionAt(
    e.id,
    e.position.x,
    e.position.y,
    e.facing,
    e.zIndex,
  );
  prevPositions.set(e, e.position);
};

const handleFog = (e: Entity) =>
  e.position && onPositionOrRotationChange(e as SystemEntity<"position">);
app.addSystem({
  props: ["hiddenByFog"],
  onAdd: handleFog,
  onChange: handleFog,
  onRemove: handleFog,
});

app.addSystem({
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
  if (!app.entities.has(e)) return;
  const model = e.model ?? e.prefab;
  if (!model) return;
  const collection = collections[model];
  if (!collection) return console.warn(`No ${e.model} SVG on ${e.id}`);
  collection.setScaleAt(e.id, e.modelScale ?? 1, e.aspectRatio);
};
app.addSystem({
  props: ["modelScale"],
  onAdd: updateScale,
  onChange: updateScale,
  onRemove: updateScale,
});
app.addSystem({
  props: ["aspectRatio"],
  onAdd: updateScale,
  onChange: updateScale,
  onRemove: updateScale,
});

app.addSystem({
  props: ["progress", "completionTime"],
  updateEntity: (e, delta) => {
    if (e.progress + delta >= 1) {
      return delete (e as Entity).progress;
    }
    e.progress += delta / e.completionTime;
  },
});

const updateAlpha = (e: Entity) => {
  if (!app.entities.has(e)) return;
  const collection = collections[e.model ?? e.prefab ?? ""];
  if (!collection) return;
  collection.setAlphaAt(
    e.id,
    typeof e.progress === "number" ? e.progress : 1,
    typeof e.progress === "number",
  );
};
app.addSystem({
  props: ["progress"],
  onAdd: updateAlpha,
  onChange: updateAlpha,
  onRemove: updateAlpha,
});

const wasCastingMirror = new Map<Entity, number>();

app.addSystem({
  props: ["order", "position"],
  onChange: (e) => {
    if (e.order.type === "cast" && e.order.orderId === "mirrorImage") {
      wasCastingMirror.set(e, e.order.remaining + 0.1);
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
      if (!model || !e.position) {
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
app.addSystem({
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
