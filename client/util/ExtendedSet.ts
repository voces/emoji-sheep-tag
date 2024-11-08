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

  clone() {
    return new ExtendedSet(this);
  }

  group<U>(
    fn: (item: T) => U,
  ): U extends string ? Record<string, ExtendedSet<T> | undefined>
    : Map<U, ExtendedSet<T> | undefined> {
    type Result = U extends string ? Record<string, ExtendedSet<T> | undefined>
      : Map<U, ExtendedSet<T> | undefined>;

    const values = this.values();

    // Determine initial container type and seed it
    const first = values.next();
    if (first.done) return {} as Result;
    const firstValue = first.value;
    const firstGroup = fn(firstValue);
    let isMap = typeof firstGroup !== "string";
    const set = new ExtendedSet([firstValue]);

    // Create container
    let container =
      (isMap
        ? new Map([[firstGroup, set]])
        : { [firstGroup as string]: set }) as Result;

    // Iterate through rest of values
    while (!first.done) {
      const next = values.next();
      if (next.done) return container;

      const value = next.value;
      const group = fn(value);

      // Change to map if we find a non-string key
      const curIsMap = typeof group !== "string";
      if (!isMap && curIsMap) {
        container = new Map(Object.entries(container)) as Result;
        isMap = true;
      }

      // Handle maps
      if (container instanceof Map) {
        const prev = container.get(group);
        if (prev) prev.add(value);
        else container.set(group, new ExtendedSet([value]));

        // Handle records
      } else {
        const castContainer = container as Record<
          U & string,
          ExtendedSet<T> | undefined
        >;
        const prev = castContainer[group as U & string];
        if (prev) prev.add(value);
        else castContainer[group as U & string] = new ExtendedSet([value]);
      }
    }
    return container;
  }
}
