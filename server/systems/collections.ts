import { addSystem, appContext } from "@/shared/context.ts";
import { App } from "@verit/ecs";
import { Entity } from "@/shared/types.ts";
import { raise } from "@/shared/util/raise.ts";
import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";
import { isStructure } from "@/shared/api/unit.ts";

type Collections = {
  sheep: ExtendedSet<Entity>;
  wolves: ExtendedSet<Entity>;
  foxes: ExtendedSet<Entity>;
  spirits: ExtendedSet<Entity>;
  structures: ExtendedSet<Entity>;
};

const map = new WeakMap<App<Entity>, Collections>();

const getCollections = () =>
  map.get(appContext.current) ??
    raise("Expected collections to exist for app");

export function getSheep(): ExtendedSet<Entity>;
export function getSheep(player: string): Entity | undefined;
export function getSheep(player?: string | undefined) {
  const sheep = getCollections().sheep;
  return player ? sheep.find((s) => s.owner === player) : sheep;
}

export const getWolves = () => getCollections().wolves;
export const getFoxes = () => getCollections().foxes;
export const getSpirits = () => getCollections().spirits;
export const getStructures = () => getCollections().structures;

addSystem((app) => {
  const collections: Collections = {
    sheep: new ExtendedSet<Entity>(),
    wolves: new ExtendedSet<Entity>(),
    foxes: new ExtendedSet<Entity>(),
    spirits: new ExtendedSet<Entity>(),
    structures: new ExtendedSet<Entity>(),
  };
  map.set(app, collections);

  const prefabToSet: Record<string, ExtendedSet<Entity> | undefined> = {
    sheep: collections.sheep,
    wolf: collections.wolves,
    fox: collections.foxes,
    spirit: collections.spirits,
  };

  return {
    props: ["prefab"],
    onAdd: (e) => {
      if (e.prefab) prefabToSet[e.prefab]?.add(e);
      if (isStructure(e)) collections.structures.add(e);
    },
    onRemove: (e) => {
      if (e.prefab) prefabToSet[e.prefab]?.delete(e);
      collections.structures.delete(e);
    },
  };
});
