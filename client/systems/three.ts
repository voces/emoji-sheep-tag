import { Color } from "three";

import { app, Entity } from "../ecs.ts";
import { InstancedGroup } from "../graphics/InstancedGroup.ts";
import { loadSvg } from "../graphics/loadSvg.ts";
import { isLocalPlayer, playersVar } from "../ui/vars/players.ts";

//@deno-types="../assets/svg.d.ts"
import sheepSvg from "../assets/sheep.svg";
//@deno-types="../assets/svg.d.ts"
import wolfSvg from "../assets/wolf.svg";
//@deno-types="../assets/svg.d.ts"
import hutSvg from "../assets/hut.svg";
//@deno-types="../assets/svg.d.ts"
import fenceSvg from "../assets/fence.svg";
import { getFps } from "../graphics/three.ts";

const sheep = loadSvg(sheepSvg, 1);
const wolf = loadSvg(wolfSvg, 2);
const hut = loadSvg(hutSvg, 2);
const tinyHut = loadSvg(hutSvg, 1);
const wideHut = loadSvg(hutSvg, 3);
const rotundHut = loadSvg(hutSvg, 4);
const fence = loadSvg(fenceSvg, 0.07, { layer: 2 });

const collections: Record<string, InstancedGroup | undefined> = {
  sheep,
  wolf,
  hut,
  tinyHut,
  wideHut,
  rotundHut,
  fence,
};

const color = new Color();
const color2 = new Color();
const blue = new Color(0x0000ff);
const white = new Color("white");

// Auto select unit
app.addSystem({
  props: ["id", "unitType", "owner"],
  onAdd: (e) => {
    const collection = collections[e.unitType];
    if (!collection) return;
    const p = playersVar().find((p) => p.id === e.owner);
    if (p) {
      color.set(p.color);
      if (e.blueprint) {
        color2.set(color);
        color2.lerp(white, 0.8);
        color2.lerp(blue, 0.6);
        collection.setVertexColorAt(e.id, color2);
        collection.setPlayerColorAt(e.id, color, false);
      } else {
        collection.setPlayerColorAt(e.id, color);
      }
    }
    if (
      isLocalPlayer(e.owner) &&
      (e.unitType === "sheep" || e.unitType === "wolf")
    ) {
      e.selected = true;
    }
  },
});

function getDirection(angle: number) {
  // Normalize the angle to the range [-π, π]
  const normalizedAngle = (angle + Math.PI) % (2 * Math.PI) - Math.PI;

  // Determine direction
  return Math.abs(normalizedAngle) <= Math.PI / 2 ? "right" : "left";
}

const prevPositions = new WeakMap<Entity, Entity["position"]>();
// Reflect logical position to render position
app.addSystem({
  props: ["id", "unitType", "position"],
  onAdd: (e) => {
    prevPositions.set(e, e.position);
    collections[e.unitType]?.setPositionAt(
      e.id,
      e.position.x,
      e.position.y,
    );
  },
  onChange: (e) => {
    if (e.isMoving) {
      const prev = prevPositions.get(e);
      if (prev) {
        const delta =
          ((prev.x - e.position.x) ** 2 + (prev.y - e.position.y) ** 2) ** 0.5;
        const movement = (e.movementSpeed ?? 0) / getFps();
        const jerk = delta / movement;

        const angle = Math.atan2(
          e.position.y - prev.y,
          e.position.x - prev.x,
        );

        console.log("moving", getDirection(angle));

        if (jerk > 1.05 && jerk < 15) {
          const angle = Math.atan2(
            e.position.y - prev.y,
            e.position.x - prev.x,
          );
          const dist = movement * 1.05;
          const x = prev.x + dist * Math.cos(angle);
          const y = prev.y + dist * Math.sin(angle);
          console.log(
            "correct",
            Math.round(jerk * 100) / 100,
          );
          collections[e.unitType]?.setPositionAt(e.id, x, y);
          prevPositions.set(e, { x, y });
          return;
        } else if (jerk > 3) {
          console.log("HUGE jerk", jerk);
        }
      }
    }
    collections[e.unitType]?.setPositionAt(
      e.id,
      e.position.x,
      e.position.y,
    );
    prevPositions.set(e, e.position);
  },
  onRemove: (e) => collections[e.unitType!]?.delete(e.id),
});
