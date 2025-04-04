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
};

const collections: Record<string, InstancedGroup | undefined> = {
  sheep: loadSvg(sheep, 1),
  wolf: loadSvg(wolf, 2),
  hut: loadSvg(hut, 2),
  fence: loadSvg(fence, 0.07, { layer: 2, zIndex: -0.004 }),
  fire: loadSvg(fire, 1, { layer: 2 }),
  claw: loadSvg(claw, 0.05, { layer: 2, zIndex: 0.25 }),
  collision: loadSvg(collision, 2, { layer: 2, zIndex: -0.001 }),
  flowers: loadSvg(flowers, 0.25, { layer: 2, zIndex: -0.002 }),
  grass: loadSvg(grass, 0.75, { layer: 2, zIndex: -0.003 }),
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
  if (typeof e.blueprint === "number") {
    temp.setHex(e.blueprint);
    color2.set(color);
    color2.lerp(white, 0.8);
    color2.lerp(temp, 0.6);
    collection.setVertexColorAt(e.id, color2);
    collection.setPlayerColorAt(e.id, color, false);
  } else {
    collection.setPlayerColorAt(e.id, color);
  }
};

app.addSystem({
  props: ["id", "unitType", "owner"],
  onAdd: updateColor,
  onChange: updateColor,
});

app.addSystem({
  props: ["blueprint"],
  onChange: (e) => e.unitType && e.owner && updateColor(e),
});

const prevPositions = new WeakMap<Entity, Entity["position"]>();

const onPositionOrRotationChange = (
  e: SystemEntity<Entity, "unitType"> & {
    readonly position: { x: number; y: number };
    readonly facing?: number;
  },
) => {
  const model = e.model ?? e.unitType;
  if (e.isMoving) {
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
