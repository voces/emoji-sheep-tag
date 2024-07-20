export class ExtendedSet<T> extends Set<T> {
  /** Returns true if `predicate` returns a truthy value for any element. */
  some(predicate: (value: T) => unknown) {
    for (const entity of this) if (predicate(entity)) return true;
    return false;
  }

  filter<U extends T>(
    predicate: ((value: T) => value is U) | ((value: T) => unknown),
  ) {
    const newSet = new ExtendedSet<U>();
    for (const entity of this) if (predicate(entity)) newSet.add(entity as U);
    return newSet;
  }
}
