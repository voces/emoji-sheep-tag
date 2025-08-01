import { Color } from "three";

import { app, Entity } from "../ecs.ts";
import { InstancedGroup } from "../graphics/InstancedGroup.ts";
import { loadSvg } from "../graphics/loadSvg.ts";
import { playersVar } from "../ui/vars/players.ts";
import { getFps } from "../graphics/three.ts";
import { SystemEntity } from "jsr:@verit/ecs";

//@deno-types="../assets/asset.d.ts"
import sheep from "../assets/sheep.svg";
//@deno-types="../assets/asset.d.ts"
import wolf from "../assets/wolf.svg";
//@deno-types="../assets/asset.d.ts"
import hut from "../assets/hut.svg";
//@deno-types="../assets/asset.d.ts"
import fence from "../assets/fence.svg";
//@deno-types="../assets/asset.d.ts"
import fire from "../assets/fire.svg";
//@deno-types="../assets/asset.d.ts"
import claw from "../assets/claw.svg";
//@deno-types="../assets/asset.d.ts"
import collision from "../assets/collision.svg";
//@deno-types="../assets/asset.d.ts"
import flowers from "../assets/flowers.svg";
//@deno-types="../assets/asset.d.ts"
import grass from "../assets/grass.svg";
//@deno-types="../assets/asset.d.ts"
import suspend from "../assets/suspend.svg";
//@deno-types="../assets/asset.d.ts"
import circle from "../assets/circle.svg";
//@deno-types="../assets/asset.d.ts"
import gravity from "../assets/gravity.svg";
//@deno-types="../assets/asset.d.ts"
import hinduTemple from "../assets/hindu-temple.svg";
//@deno-types="../assets/asset.d.ts"
import route from "../assets/route.svg";
//@deno-types="../assets/asset.d.ts"
import stop from "../assets/stop.svg";

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
};

const collections: Record<string, InstancedGroup | undefined> = {
  sheep: loadSvg(sheep, 1),
  wolf: loadSvg(wolf, 2),
  hut: loadSvg(hut, 2),
  fence: loadSvg(fence, 0.07, { layer: 2 }),
  fire: loadSvg(fire, 1, { layer: 2 }),
  claw: loadSvg(claw, 0.05, { layer: 2 }),
  collision: loadSvg(collision, 2, { layer: 2 }),
  flowers: loadSvg(flowers, 0.25, { layer: 2 }),
  grass: loadSvg(grass, 0.75, { layer: 2 }),
  circle: loadSvg(circle, 0.08, { layer: 2 }),
  gravity: loadSvg(gravity, 2, { layer: 2 }),
  hinduTemple: loadSvg(hinduTemple, 1.75),
};
Object.assign(globalThis, { collections });

const color = new Color();
const color2 = new Color();
const white = new Color("white");
const temp = new Color(0x0000ff);

const updateColor = (e: Entity) => {
  if (!e.unitType) return;
  const collection = collections[e.model ?? e.unitType];
  if (!collection) return;
  const hex = e.playerColor ??
    playersVar().find((p) => p.id === e.owner)?.color;
  if (!hex) return;
  color.set(hex);
  if (e.owner || e.playerColor) {
    if (typeof e.blueprint === "number") {
      temp.setHex(e.blueprint);
      color2.set(color);
      color2.lerp(white, 0.8);
      color2.lerp(temp, 0.6);
      collection.setVertexColorAt(e.id, color2, { alpha: 0.75 });
      collection.setPlayerColorAt(e.id, color, { overrideVertex: false });
    } else {
      collection.setPlayerColorAt(e.id, color, {
        alpha: typeof e.progress === "number" ? e.progress : undefined,
        progressiveAlpha: typeof e.progress === "number",
      });
    }
  }
};

app.addSystem({
  props: ["id", "unitType", "owner"],
  onAdd: updateColor,
  onChange: updateColor,
});

app.addSystem({
  props: ["blueprint"],
  onAdd: updateColor,
  onChange: updateColor,
});

const prevPositions = new WeakMap<Entity, Entity["position"]>();

const onPositionOrRotationChange = (
  e: SystemEntity<Entity, "unitType"> & {
    readonly position: { x: number; y: number };
    readonly facing?: number;
  },
) => {
  const model = e.model ?? e.unitType;
  if (e.action?.type === "walk") {
    const prev = prevPositions.get(e);
    if (prev) {
      const delta =
        ((prev.x - e.position.x) ** 2 + (prev.y - e.position.y) ** 2) ** 0.5;
      const movement = (e.movementSpeed ?? 0) / getFps();
      const jerk = delta / movement;

      if (jerk > 1.05 && jerk < 15) {
        const angle = Math.atan2(
          e.position.y - prev.y,
          e.position.x - prev.x,
        );
        const dist = movement * 1.05;
        const x = prev.x + dist * Math.cos(angle);
        const y = prev.y + dist * Math.sin(angle);
        collections[model]?.setPositionAt(e.id, x, y, e.facing, e.zIndex);
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

// Reflect logical position to render position
app.addSystem({
  props: ["unitType", "position"],
  onAdd: (e: SystemEntity<Entity, "unitType" | "position">) => {
    prevPositions.set(e, e.position);
    collections[e.model ?? e.unitType]?.setPositionAt(
      e.id,
      e.position.x,
      e.position.y,
      e.facing,
      e.zIndex,
    );
  },
  onChange: onPositionOrRotationChange,
  onRemove: (e) => collections[e.model ?? e.unitType!]?.delete(e.id),
});

app.addSystem({
  props: ["unitType", "facing"],
  onChange: (e) => {
    if (e.position) {
      onPositionOrRotationChange(
        e as SystemEntity<Entity, "unitType" | "position" | "facing">,
      );
    }
  },
});

// Apply playerColor override
app.addSystem({
  props: ["unitType", "playerColor"],
  onAdd: updateColor,
  onChange: updateColor,
});

const updateScale = (e: SystemEntity<Entity, "unitType" | "modelScale">) => {
  const collection = collections[e.model ?? e.unitType];
  if (!collection) return;
  collection.setScaleAt(e.id, e.modelScale);
};
app.addSystem({
  props: ["unitType", "modelScale"],
  onAdd: updateScale,
  onChange: updateScale,
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
  const collection = collections[e.model ?? e.unitType ?? ""];
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
