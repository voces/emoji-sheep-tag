import { Entity, SystemEntity } from "@/shared/types.ts";
import { DoublyLinkedList } from "../util/list.ts";
import { addSystem, appContext } from "@/shared/context.ts";
import { App } from "jsr:@verit/ecs";

type PlayerEntity = SystemEntity<"owner">;

type PlayerEntityMap = Record<
  string,
  DoublyLinkedList<Entity> | undefined
>;

const maps = new WeakMap<App<Entity>, PlayerEntityMap>();

export const getPlayerUnits = (player: string) => {
  const map = maps.get(appContext.current);
  if (!map || !map[player]) return (function* () {})();
  return map[player][Symbol.iterator]() as IterableIterator<PlayerEntity>;
};

export const findPlayerUnit = <
  U extends PlayerEntity,
  Fn extends
    | ((value: PlayerEntity) => value is U)
    | ((value: PlayerEntity) => boolean),
>(player: string, fn: Fn) => {
  const map = maps.get(appContext.current);
  if (!map || !map[player]) return;
  return (map[player] as DoublyLinkedList<PlayerEntity>).find(fn);
};

export const getPlayerUnitsReversed = (player: string) => {
  const map = maps.get(appContext.current);
  if (!map || !map[player]) return (function* () {})();
  return map[player].inReverse() as IterableIterator<PlayerEntity>;
};

export const findLastPlayerUnit = <
  U extends PlayerEntity,
  Fn extends
    | ((value: PlayerEntity) => value is U)
    | ((value: PlayerEntity) => boolean),
>(player: string, fn: Fn) => {
  const map = maps.get(appContext.current);
  if (!map || !map[player]) return;
  return (map[player] as DoublyLinkedList<PlayerEntity>).findLast(fn);
};

addSystem((app) => {
  const map: PlayerEntityMap = {};
  const prevOwner = new Map<Entity, string>();
  maps.set(app, map);

  return {
    props: ["owner"],
    onAdd: (e) => {
      const playerMap = map[e.owner] ?? (map[e.owner] = new DoublyLinkedList());
      playerMap.append(e);
      prevOwner.set(e, e.owner);
    },
    onChange: (e) => {
      const prev = prevOwner.get(e);
      if (prev && map[prev]) map[prev].delete(e);

      const playerMap = map[e.owner] ?? (map[e.owner] = new DoublyLinkedList());
      playerMap.append(e);
      prevOwner.set(e, e.owner);
    },
    onRemove: (e) => {
      const prev = prevOwner.get(e);
      if (prev && map[prev]) map[prev].delete(e);
    },
  };
});
