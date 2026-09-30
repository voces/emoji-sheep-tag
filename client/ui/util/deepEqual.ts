const isObject = (value: unknown): value is object =>
  typeof value === "object" && value !== null;

export const deepEqual = (
  a: unknown,
  b: unknown,
  seen = new WeakMap<object, WeakSet<object>>(),
): boolean => {
  if (a === b) return true;
  if (!isObject(a) || !isObject(b)) return false;

  const seenWithA = seen.get(a);
  if (seenWithA?.has(b)) return true;
  if (seenWithA) seenWithA.add(b);
  else seen.set(a, new WeakSet([b]));

  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length &&
      a.every((value, i) => deepEqual(value, b[i], seen));
  }

  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) =>
    deepEqual(Reflect.get(a, key), Reflect.get(b, key), seen)
  );
};
