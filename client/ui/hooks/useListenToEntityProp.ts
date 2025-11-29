import { useEffect, useState } from "react";
import { Entity, listen } from "../../ecs.ts";

// Shared throttling logic with trailing call
const throttle = <T>(
  callback: (value: T) => void,
  delay: number,
) => {
  let timeoutId: number | undefined;
  let pendingValue: T | undefined;
  let hasPendingUpdate = false;

  const throttledCallback = (value: T) => {
    pendingValue = value;

    // Throttle: execute immediately if not already scheduled, otherwise queue
    if (timeoutId === undefined) {
      callback(value);
      timeoutId = setTimeout(() => {
        if (hasPendingUpdate) {
          callback(pendingValue!);
          hasPendingUpdate = false;
        }
        timeoutId = undefined;
      }, delay);
    } else {
      hasPendingUpdate = true;
    }
  };

  const cleanup = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      // Apply trailing update
      if (hasPendingUpdate) {
        callback(pendingValue!);
      }
    }
  };

  return { throttledCallback, cleanup };
};

export const useListenToEntityProp = <P extends keyof Entity, T = Entity[P]>(
  entity: Entity | undefined,
  prop: P,
  transform?: (value: Entity[P]) => T,
) => {
  const [value, setValue] = useState<T>(
    transform && entity?.[prop] !== undefined
      ? transform(entity[prop])
      : (entity?.[prop] as T),
  );
  useEffect(
    () => {
      if (!entity) return undefined;

      const { throttledCallback, cleanup } = throttle(setValue, 100);
      const cb = (e: Entity) =>
        throttledCallback(
          transform ? transform(e[prop]) : (e[prop] as T),
        );
      const unsubscribe = listen(entity, prop, cb);
      cb(entity);

      return () => {
        cleanup();
        unsubscribe();
      };
    },
    [entity, prop, transform],
  );

  return value;
};

export const useListenToEntityProps = <
  P extends keyof Entity,
  T = { [K in P]: Entity[K] },
>(
  entity: Entity | undefined,
  props: P[],
  transform?: (value: { [K in P]: Entity[K] }) => T,
) => {
  const initialValue = Object.fromEntries(
    props.map((prop) => [prop, entity?.[prop]]),
  ) as { [K in P]: Entity[K] };

  const [value, setValue] = useState<T>(
    transform ? transform(initialValue) : (initialValue as T),
  );

  useEffect(
    () => {
      if (!entity) return undefined;

      const { throttledCallback, cleanup } = throttle(setValue, 100);
      const cb = (e: Entity) => {
        const propsValue = Object.fromEntries(
          props.map((prop) => [prop, e?.[prop]]),
        ) as { [K in P]: Entity[K] };
        throttledCallback(
          transform ? transform(propsValue) : (propsValue as T),
        );
      };
      const unsubscribe = listen(entity, props, cb);
      cb(entity);

      return () => {
        cleanup();
        unsubscribe();
      };
    },
    [entity, props.join(" | "), transform],
  );

  return value;
};

export const useListenToEntities = (
  entities: ReadonlySet<Entity> | ReadonlyArray<Entity>,
  props: (keyof Entity)[],
) => {
  const [, setValue] = useState(0);
  useEffect(
    () => {
      const { throttledCallback, cleanup } = throttle(
        () => setValue((v) => v + 1),
        100,
      );
      const unsubs = Array.from(
        entities,
        (e) => listen(e, props, () => throttledCallback(undefined)),
      );
      setValue((v) => v + 1);
      return () => {
        cleanup();
        unsubs.forEach((fn) => fn());
      };
    },
    [Array.from(entities, (e) => e.id).join(" | "), props.join(" | ")],
  );
};
