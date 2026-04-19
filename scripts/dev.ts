import esbuild from "esbuild";
import {
  buildOptions,
  cleanOldBundles,
  copyHtml,
  copyMaps,
  extractFilenames,
} from "./build.ts";
import { processSoundAssets } from "./processSoundAssets.ts";
import { ensureDir } from "@std/fs";

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

await ensureDir("dist");
await cleanOldBundles();

const ctx = await esbuild.context(await buildOptions("dev"));

const rebuild = async () => {
  const start = performance.now();
  await cleanOldBundles();

  const result = await ctx.rebuild();
  const filenames = extractFilenames(result.metafile!.outputs);

  await Promise.all([
    copyHtml(filenames),
    processSoundAssets(),
    copyMaps(),
  ]);

  console.log(
    "[Build] Built in",
    Math.round(performance.now() - start),
    "ms!",
  );
};

const debouncedRebuild = debounce(
  () => rebuild().catch(console.error),
  25,
);

await debouncedRebuild();
console.log("[Build] Waiting for changes...");

const watcher = Deno.watchFs(["client", "shared/maps"]);
for await (const _ of watcher) {
  debouncedRebuild();
}
