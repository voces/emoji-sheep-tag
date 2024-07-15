import { Color } from "three";

import { app } from "../ecs.ts";
import { InstancedGroup } from "../InstancedGroup.ts";
import { loadSvg } from "../loadSvg.ts";
import { getLocalPlayer, playersVar } from "../ui/vars/players.ts";

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

// Auto select unit
app.addSystem({
  props: ["id", "unitType", "owner"],
  onAdd: (e) => {
    const collection = collections[e.unitType];
    if (!collection) return;
    const p = playersVar().find((p) => p.id === e.owner);
    if (p) collection.setColorAt(e.id, new Color(p.color));
    if (
      e.owner === getLocalPlayer()?.id &&
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
  onRemove: (e) => {
    console.log("delete", e);
    collections[e.unitType!]?.delete(e.id!);
  },
});
