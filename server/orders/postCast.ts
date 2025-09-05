import { Entity, Item } from "@/shared/types.ts";
import { consumeItem } from "../api/unit.ts";

export const postCast = (entity: Entity, item?: Item): boolean => {
  if (item) consumeItem(entity, item);

  return true;
};
