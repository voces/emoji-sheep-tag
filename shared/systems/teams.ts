import { App } from "@verit/ecs";
import { Entity, SystemEntity } from "../types.ts";
import { ExtendedSet } from "../util/ExtendedSet.ts";
import { addSystem, appContext } from "../context.ts";
import { raise } from "../util/raise.ts";

type Player = SystemEntity<"isPlayer" | "team">;

const map = new WeakMap<
  App<Entity>,
  { sheep: ExtendedSet<Player>; wolves: ExtendedSet<Player> }
>();

// TODO: kill this?
export const getTeams = () =>
  map.get(appContext.current) ?? raise("Expected team map to be set for app");

addSystem((app) => {
  const data = {
    sheep: new ExtendedSet<Player>(),
    wolves: new ExtendedSet<Player>(),
  };
  map.set(app, data);

  return ({
    props: ["isPlayer", "team"],
    onAdd: (entity) => {
      if (entity.team === "sheep") data.sheep.add(entity);
      else if (entity.team === "wolf") data.wolves.add(entity);
    },
    onChange: (entity) => {
      data.sheep.delete(entity);
      data.wolves.delete(entity);
      if (entity.team === "sheep") data.sheep.add(entity);
      else if (entity.team === "wolf") data.wolves.add(entity);
    },
    onRemove: (entity) => {
      data.sheep.delete(entity as Player);
      data.wolves.delete(entity as Player);
    },
  });
});
