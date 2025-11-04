import { App } from "@verit/ecs";
import { addSystem, appContext } from "@/shared/context.ts";
import { Entity, SystemEntity } from "../types.ts";
import { ExtendedSet } from "../util/ExtendedSet.ts";
import { raise } from "../util/raise.ts";

export type Player = SystemEntity<"isPlayer">;

const map = new WeakMap<App<Entity>, ExtendedSet<Player>>();

export const playerEntities = () =>
  map.get(appContext.current) ??
    raise("Expected player entities to be initialized");

addSystem((app) => {
  const entities = new ExtendedSet<Player>();
  map.set(app, entities);
  return { props: ["isPlayer"], entities };
});

export const getPlayers = (): readonly Player[] =>
  Array.from(map.get(appContext.current) ?? []);

export const getPlayer = (playerId: string | undefined): Player | undefined =>
  getPlayers().find((p) => p.id === playerId);

export const getSheepPlayers = (): Player[] =>
  getPlayers().filter((p) => p.team === "sheep");

export const getWolfPlayers = (): Player[] =>
  getPlayers().filter((p) => p.team === "wolf");

export const colorName = (
  player: { color: string; name: string } | {
    playerColor?: string | undefined | null;
    name?: string | undefined;
  },
) =>
  `|c${("color" in player ? player.color : player.playerColor) || "#FFFFFF"}|${
    player.name ?? "<unknown>"
  }|`;
