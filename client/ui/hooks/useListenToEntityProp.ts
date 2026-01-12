import { useEffect, useRef, useState } from "react";
import { Entity, listen } from "../../ecs.ts";

const deepEqual = (
  a: unknown,
  b: unknown,
  seen = new WeakMap<object, WeakSet<object>>(),
): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === "object") {
    const seenWithA = seen.get(a);
    if (seenWithA?.has(b as object)) return true;
    if (!seenWithA) seen.set(a, new WeakSet([b as object]));
    else seenWithA.add(b as object);

    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i], seen)) return false;
      }
      return true;
    }

    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (
        !deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
          seen,
        )
      ) return false;
    }
    return true;
  }

  return false;
};

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
  const cachedRef = useRef<T | undefined>(undefined);

  useEffect(
    () => {
      if (!entity) return undefined;

      const setValueIfChanged = (newValue: T) => {
        if (transform) {
          if (!deepEqual(cachedRef.current, newValue)) {
            cachedRef.current = newValue;
            setValue(newValue);
          }
        } else {
          setValue(newValue);
        }
      };

      const { throttledCallback, cleanup } = throttle(setValueIfChanged, 100);
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
  const cachedRef = useRef<T | undefined>(undefined);

  useEffect(
    () => {
      if (!entity) return undefined;

      const setValueIfChanged = (newValue: T) => {
        if (transform) {
          if (!deepEqual(cachedRef.current, newValue)) {
            cachedRef.current = newValue;
            setValue(newValue);
          }
        } else {
          setValue(newValue);
        }
      };

      const { throttledCallback, cleanup } = throttle(setValueIfChanged, 100);
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
