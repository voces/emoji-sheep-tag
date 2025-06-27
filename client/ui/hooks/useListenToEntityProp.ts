import { useEffect, useState } from "react";
import { Entity, listen } from "../../ecs.ts";

export const useListenToEntityProp = <P extends keyof Entity>(
  entity: Entity | undefined,
  prop: P,
) => {
  const [value, setValue] = useState(entity?.[prop]);
  useEffect(
    () => entity ? listen(entity, prop, (e) => setValue(e[prop])) : undefined,
    [entity, prop],
  );

  return value;
};
