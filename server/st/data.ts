import { Entity } from "@/shared/types.ts";
import { Client } from "../client.ts";
import { appContext } from "@/shared/context.ts";
import { App } from "jsr:@verit/ecs";

type Player = {
  client: Client;
  sheep?: Entity;
  wolf?: Entity;
};

type SheepTagData = {
  sheep: Player[];
  wolves: Player[];
};

const map = new WeakMap<App<Entity>, SheepTagData>();
const getData = () => {
  const data = map.get(appContext.current);
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

export const init = (data: SheepTagData) => map.set(appContext.current, data);
