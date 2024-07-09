import { useEffect, useState } from "npm:react";

type ReactiveVar<T> = ((newValue?: T) => T) & {
  subscribe: (callback: (newValue: T, prevValue: T) => void) => () => void;
};

export const makeVar = <T,>(initialValue: T): ReactiveVar<T> => {
  let value = initialValue;
  let listeners: Set<(newValue: T, prevValue: T) => void> = new Set();

  const subscribe = (callback: (newValue: T, prevValue: T) => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  };

  const fn = (newValue?: T) => {
    if (newValue) {
      const oldValue = value;
      value = newValue;
      for (const listener of listeners) listener(newValue, oldValue);
    }
    return value;
  };

  return Object.assign(fn, { subscribe }) as ReactiveVar<T>;
};

export const useReactiveVar = <T,>(reactiveVar: ReactiveVar<T>): T => {
  const [value, setValue] = useState(reactiveVar());

  useEffect(
    () => reactiveVar.subscribe((newValue) => setValue(newValue)),
    [],
  );

  return value;
};
