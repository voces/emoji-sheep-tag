import { useEffect, useReducer, useRef, useState } from "react";
import { deepEqual } from "../util/deepEqual.ts";
import { Entity, listen } from "../../ecs.ts";

// Shared batch flush: one timer for all throttled listeners
let batchTimeout: number | undefined;
const pendingFlushes = new Set<() => void>();

const scheduleBatchFlush = (flush: () => void) => {
  pendingFlushes.add(flush);
  if (batchTimeout === undefined) {
    batchTimeout = setTimeout(() => {
      batchTimeout = undefined;
      const flushing = [...pendingFlushes];
      pendingFlushes.clear();
      for (const fn of flushing) fn();
    }, 100);
  }
};

export const __testing_clearBatchFlush = () => {
  clearTimeout(batchTimeout);
  batchTimeout = undefined;
  pendingFlushes.clear();
};

const throttle = <T>(
  callback: (value: T) => void,
) => {
  let pendingValue: T | undefined;
  let hasPendingUpdate = false;
  let coolingDown = false;

  const flush = () => {
    coolingDown = false;
    if (hasPendingUpdate) {
      hasPendingUpdate = false;
      callback(pendingValue!);
    }
  };

  const throttledCallback = (value: T) => {
    pendingValue = value;
    if (!coolingDown) {
      coolingDown = true;
      callback(value);
      scheduleBatchFlush(flush);
    } else {
      hasPendingUpdate = true;
    }
  };

  const cleanup = () => {
    pendingFlushes.delete(flush);
    if (hasPendingUpdate) {
      hasPendingUpdate = false;
      callback(pendingValue!);
    }
  };

  return { throttledCallback, cleanup };
};

type PropsOf<P extends keyof Entity> = { [K in P]: Entity[K] };

const pickProps = <P extends keyof Entity>(
  entity: Entity | undefined,
  props: readonly P[],
) =>
  Object.fromEntries(props.map((prop) => [prop, entity?.[prop]])) as PropsOf<
    P
  >;

export const useListenToEntityProps = <
  P extends keyof Entity,
  T = PropsOf<P>,
>(
  entity: Entity | undefined,
  props: P[],
  transform?: (value: PropsOf<P>) => T,
): T => {
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const propsRef = useRef(props);
  propsRef.current = props;
  const cachedRef = useRef<{ value: T } | undefined>(undefined);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const read = (e: Entity | undefined): T => {
    const picked = pickProps(e, propsRef.current);
    return transformRef.current ? transformRef.current(picked) : (picked as T);
  };

  const findCached = (value: T) => {
    const cached = cachedRef.current;
    return transformRef.current && cached && deepEqual(cached.value, value)
      ? cached
      : undefined;
  };

  const current = read(entity);
  const cached = findCached(current) ??
    (cachedRef.current = { value: current });

  const key = props.join(" | ");
  useEffect(
    () => {
      if (!entity) return undefined;

      const { throttledCallback, cleanup } = throttle((e: Entity) => {
        const next = read(e);
        if (findCached(next)) return;
        cachedRef.current = { value: next };
        rerender();
      });
      const unsubscribe = listen(entity, propsRef.current, throttledCallback);
      throttledCallback(entity);

      return () => {
        cleanup();
        unsubscribe();
      };
    },
    [entity, key],
  );

  return cached.value;
};

export const useListenToEntityProp = <P extends keyof Entity, T = Entity[P]>(
  entity: Entity | undefined,
  prop: P,
  transform?: (value: Entity[P]) => T,
): T =>
  useListenToEntityProps(
    entity,
    [prop],
    (value) => transform ? transform(value[prop]) : (value[prop] as T),
  );

export const useListenToEntities = (
  entities: ReadonlySet<Entity> | ReadonlyArray<Entity>,
  props: (keyof Entity)[],
): number => {
  const [version, setValue] = useState(0);
  useEffect(
    () => {
      const { throttledCallback, cleanup } = throttle(
        () => setValue((v) => v + 1),
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
  return version;
};
