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

export const useListenToEntityProp = <P extends keyof Entity>(
  entity: Entity | undefined,
  prop: P,
) => {
  const [value, setValue] = useState(entity?.[prop]);
  useEffect(
    () => {
      if (!entity) return undefined;

      const { throttledCallback, cleanup } = throttle(setValue, 100);
      const unsubscribe = listen(
        entity,
        prop,
        (e) => throttledCallback(e[prop]),
      );

      return () => {
        cleanup();
        unsubscribe();
      };
    },
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
    () => {
      if (!entity) return undefined;

      const { throttledCallback, cleanup } = throttle(setValue, 100);
      const unsubscribe = listen(
        entity,
        props,
        (e) =>
          throttledCallback(
            Object.fromEntries(props.map((prop) => [prop, e?.[prop]])),
          ),
      );

      return () => {
        cleanup();
        unsubscribe();
      };
    },
    [entity, props.join(" | ")],
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
      return () => {
        cleanup();
        unsubs.forEach((fn) => fn());
      };
    },
    [Array.from(entities, (e) => e.id).join(" | "), props.join(" | ")],
  );
};
