import { Entity } from "../../shared/types.ts";
import { Client } from "../client.ts";
import { currentApp } from "../contexts.ts";
import { Game } from "../ecs.ts";

type Player = {
  client: Client;
  sheep?: Entity;
  wolf?: Entity;
};

type SheepTagData = {
  sheep: Player[];
  wolves: Player[];
};

const map = new WeakMap<Game, SheepTagData>();
const getData = () => {
  const data = map.get(currentApp());
  if (!data) throw new Error("Expected data to be initialized");
  return data;
};

export const data = new Proxy<SheepTagData>({} as SheepTagData, {
  get: (_, prop) => getData()[prop as keyof SheepTagData],
  set: (_, prop, value) => {
    getData()[prop as keyof SheepTagData] = value;
    return true;
  },
});

export const init = (data: SheepTagData) => map.set(currentApp(), data);
