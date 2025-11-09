import { build } from "./build.ts";

// deno-lint-ignore no-explicit-any
const debounce = <T extends (...args: any[]) => Promise<any>>(
  func: T,
  delay: number,
) => {
  let timeoutId: number;

  return (...args: Parameters<T>): Promise<ReturnType<T>> =>
    new Promise((resolve, reject) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        try {
          const result = await func(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
};

const debouncedBuild = debounce(() => build("dev").catch(console.error), 25);

await debouncedBuild();
console.log("[Build] Waiting for changes...");

const watcher = Deno.watchFs(["client", "shared/maps"]);
for await (const _ of watcher) {
  debouncedBuild().then(() => console.log("[Build] Waiting for changes..."));
}
