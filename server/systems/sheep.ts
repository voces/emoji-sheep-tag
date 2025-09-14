import { addSystem, appContext } from "@/shared/context.ts";
import { App } from "@verit/ecs";
import { Entity } from "@/shared/types.ts";
import { raise } from "@/shared/util/raise.ts";
import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";

const map = new WeakMap<App<Entity>, ExtendedSet<Entity>>();

export function getSheep(): ExtendedSet<Entity>;
export function getSheep(player: string): Entity;
export function getSheep(player?: string | undefined) {
  const sheep = map.get(appContext.current) ??
    raise("Expected sheep map to bet for app");
  return player
    ? sheep.find((s) => s.owner === player) ??
      raise(`Could not find sheep for ${player}`)
    : sheep;
}

addSystem((app) => {
  const sheep = new ExtendedSet<Entity>();
  map.set(app, sheep);

  return {
    props: ["prefab"],
    onAdd: (e) => (e.prefab === "sheep") && sheep.add(e),
    onRemove: (e) => (e.prefab === "sheep") && sheep.delete(e),
  };
});
