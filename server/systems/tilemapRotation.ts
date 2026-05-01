import { Entity } from "@/shared/types.ts";
import { Footprint } from "@/shared/pathing/types.ts";
import { applyTilemapRotation } from "@/shared/pathing/tilemapRotation.ts";
import { addSystem } from "@/shared/context.ts";

addSystem(() => {
  const originals = new WeakMap<Entity, Footprint>();
  const apply = (e: Entity) => applyTilemapRotation(originals, e);
  return {
    props: ["tilemap", "facing"],
    onAdd: apply,
    onChange: apply,
    onRemove: (e) => originals.delete(e),
  };
});
