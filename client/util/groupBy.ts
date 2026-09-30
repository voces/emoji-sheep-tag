/**
 * Map.groupBy, which the desktop app's system webview may lack (WebKit before
 * Safari 17.4 and WebKitGTK 2.44).
 */
export const groupBy = <T, K>(items: Iterable<T>, keyOf: (item: T) => K) => {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
};
