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

export const useListenToEntityProps = <P extends keyof Entity>(
  entity: Entity | undefined,
  props: P[],
) => {
  const [value, setValue] = useState(
    Object.fromEntries(props.map((prop) => [prop, entity?.[prop]])),
  );
  useEffect(
    () =>
      entity
        ? listen(
          entity,
          props,
          (e) =>
            setValue(
              Object.fromEntries(props.map((prop) => [prop, e?.[prop]])),
            ),
        )
        : undefined,
    [entity, props.join(" | ")],
  );

  return value;
};

export const useListenToEntities = (
  entities: Set<Entity>,
  props: (keyof Entity)[],
) => {
  const [, setValue] = useState(0);
  useEffect(
    () => {
      const unsubs = Array.from(
        entities,
        (e) => listen(e, props, () => setValue((v) => v + 1)),
      );
      return () => unsubs.forEach((fn) => fn());
    },
    [Array.from(entities, (e) => e.id).join(" | "), props.join(" | ")],
  );
};
