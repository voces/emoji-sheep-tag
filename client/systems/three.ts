import { Color } from "three";

import { app } from "../ecs.ts";
import { InstancedGroup } from "../graphics/InstancedGroup.ts";
import { loadSvg } from "../graphics/loadSvg.ts";
import { isLocalPlayer, playersVar } from "../ui/vars/players.ts";

//@deno-types="../assets/svg.d.ts"
import sheepSvg from "../assets/sheep.svg";
//@deno-types="../assets/svg.d.ts"
import wolfSvg from "../assets/wolf.svg";
//@deno-types="../assets/svg.d.ts"
import hutSvg from "../assets/hut.svg";

const sheep = loadSvg(sheepSvg, 1);
const wolves = loadSvg(wolfSvg, 2);
const huts = loadSvg(hutSvg, 2);

const collections: Record<string, InstancedGroup | undefined> = {
  sheep,
  wolf: wolves,
  hut: huts,
  // house: houses,
  // derelictHouse: derelictHouses,
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
        color2.lerp(blue, 0.5);
        collection.setVertexColorAt(e.id, color2);
        color.lerp(blue, 0.3);
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

// Reflect logical position to render position
app.addSystem({
  props: ["id", "unitType", "position"],
  onAdd: (e) => {
    collections[e.unitType]?.setPositionAt(
      e.id,
      e.position.x,
      e.position.y,
    );
  },
  onChange: (e) =>
    collections[e.unitType]?.setPositionAt(
      e.id,
      e.position.x,
      e.position.y,
    ),
  onRemove: (e) => collections[e.unitType!]?.delete(e.id),
});
