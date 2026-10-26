import esbuild, { type BuildOptions, type Plugin } from "esbuild";
import { mkdir } from "node:fs/promises";
import { join, relative } from "node:path";

const mkdirp = (dir: string) => mkdir(dir, { recursive: true });
import { processSoundAssets } from "./processSoundAssets.ts";
import { buildMapManifest } from "./buildMapManifest.ts";

const assetInlinePlugin = {
  name: "asset-inline",
  setup(build) {
    build.onResolve(
      { filter: /\.svg$/ },
      (args) => ({
        path: relative(Deno.cwd(), join(args.resolveDir, args.path)),
        namespace: "asset-inline",
      }),
    );
    build.onLoad(
      { filter: /\.svg$/, namespace: "asset-inline" },
      async (args) => ({
        contents: await Deno.readTextFile(args.path),
        loader: "text",
      }),
    );
  },
} satisfies Plugin;

// Derives esbuild `alias` entries from the deno.json import map's path
// aliases (@/...); packages resolve from node_modules.
const buildAliasFromImportMap = (
  imports: Record<string, string>,
): Record<string, string> => {
  const alias: Record<string, string> = {};
  for (const [bare, target] of Object.entries(imports)) {
    if (bare.startsWith("@/") && target.startsWith("./")) {
      alias[bare.replace(/\/$/, "")] = target.replace(/\/$/, "");
    }
  }
  return alias;
};

const entryPoints = ["client/index.ts", "server/local.ts"];

export const buildOptions = async (
  env: "dev" | "prod",
): Promise<BuildOptions> => {
  const denoJson = JSON.parse(await Deno.readTextFile("deno.json"));
  const imports: Record<string, string> = denoJson.imports ?? {};

  return {
    bundle: true,
    target: "chrome123",
    format: "esm",
    entryPoints,
    outdir: "dist",
    entryNames: "[name]-[hash]",
    sourcemap: true,
    metafile: true,
    plugins: [assetInlinePlugin],
    alias: buildAliasFromImportMap(imports),
    jsx: "automatic",
    jsxImportSource: "react",
    define: {
      "process.env.NODE_ENV": JSON.stringify(
        env === "dev" ? "development" : "production",
      ),
    },
    minify: env !== "dev",
  };
};

export const copyMaps = async () => {
  const srcDir = "shared/maps";
  const destDir = "dist/maps";
  await mkdirp(destDir);
  for await (const entry of Deno.readDir(srcDir)) {
    if (!entry.isFile || !entry.name.endsWith(".json")) continue;
    await Deno.copyFile(`${srcDir}/${entry.name}`, `${destDir}/${entry.name}`);
  }
};

export const cleanOldBundles = async () => {
  try {
    for await (const entry of Deno.readDir("dist")) {
      if (
        entry.isFile &&
        /^(index|local)-.*\.js(\.map)?$/.test(entry.name)
      ) await Deno.remove(`dist/${entry.name}`);
    }
  } catch { /* dist doesn't exist yet */ }
};

export const extractFilenames = (
  metaOutputs: Record<string, unknown>,
) => {
  const filenames = { index: "index.js", local: "local.js" };
  for (const output of Object.keys(metaOutputs)) {
    const basename = output.replace("dist/", "");
    if (basename.startsWith("index-") && basename.endsWith(".js")) {
      filenames.index = basename;
    } else if (basename.startsWith("local-") && basename.endsWith(".js")) {
      filenames.local = basename;
    }
  }
  return filenames;
};

export const copyHtml = async (
  filenames: { index: string; local: string },
) => {
  await mkdirp("dist");

  const html = await Deno.readTextFile("client/index.html");
  await Deno.writeTextFile(
    "dist/index.html",
    html
      .replace('src="index.js"', `src="${filenames.index}"`)
      .replace(
        "</head>",
        `  <script>window.__LOCAL_JS="${filenames.local}"</script>\n  </head>`,
      ),
  );
};

export const build = async (env: "dev" | "prod") => {
  const start = performance.now();

  try {
    await mkdirp("dist");
    await cleanOldBundles();
    await buildMapManifest();

    const result = await esbuild.build(await buildOptions(env));
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
  } finally {
    await esbuild.stop();
  }
};

if (import.meta.main) await build(Deno.args.includes("--dev") ? "dev" : "prod");
