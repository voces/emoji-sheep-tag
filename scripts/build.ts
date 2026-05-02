import { ensureDir } from "@std/fs";
import esbuild, { type BuildOptions, type Plugin } from "esbuild";
import { join, relative } from "@std/path";
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

// Derives esbuild `alias` entries from the deno.json import map.
// Path aliases (@/...) map to local dirs; npm subpath overrides
// (three/SVGLoader) map to node_modules paths.
const buildAliasFromImportMap = (
  imports: Record<string, string>,
): Record<string, string> => {
  const alias: Record<string, string> = {};
  for (const [bare, target] of Object.entries(imports)) {
    if (bare.startsWith("@/") && target.startsWith("./")) {
      alias[bare.replace(/\/$/, "")] = target.replace(/\/$/, "");
    } else if (
      target.startsWith("npm:") && target.includes("/examples/")
    ) {
      alias[bare] = target.replace("npm:", "./node_modules/");
    }
  }
  return alias;
};

// Collects import map entries that point to remote (non-npm) sources.
const getRemoteImports = (
  imports: Record<string, string>,
): Record<string, string> => {
  const remote: Record<string, string> = {};
  for (const [bare, target] of Object.entries(imports)) {
    if (target.startsWith("jsr:") || target.startsWith("https://")) {
      remote[bare] = target;
    }
  }
  return remote;
};

// Builds a specifier→local-file map from `deno info` for remote modules.
// Runs once at startup; the map is immutable (versioned/pinned deps).
const buildDenoResolveMap = async (
  entryPoints: string[],
): Promise<Map<string, string>> => {
  const map = new Map<string, string>();
  for (const entry of entryPoints) {
    const cmd = new Deno.Command(Deno.execPath(), {
      args: ["info", "--json", entry],
      stdout: "piped",
      stderr: "null",
    });
    const { stdout } = await cmd.output();
    const info = JSON.parse(new TextDecoder().decode(stdout));
    for (const m of info.modules) {
      if (m.local && m.specifier.startsWith("https://")) {
        map.set(m.specifier, m.local);
      }
    }
  }
  return map;
};

// Resolves non-npm remote specifiers (JSR and URL imports) using a
// pre-built map. Everything else falls through to esbuild's native
// resolver, which caches properly in incremental mode.
const denoRemotePlugin = (
  resolveMap: Map<string, string>,
  remoteImports: Record<string, string>,
): Plugin => ({
  name: "deno-remote",
  setup(build) {
    const localToUrl = new Map<string, string>();
    for (const [specifier, local] of resolveMap) {
      localToUrl.set(local, specifier);
    }

    const ns = "deno-remote";

    for (const [bare, target] of Object.entries(remoteImports)) {
      let local: string | undefined;
      if (target.startsWith("https://")) {
        local = resolveMap.get(target);
      } else if (target.startsWith("jsr:")) {
        const jsrPath = target.replace("jsr:", "");
        for (const [specifier, l] of resolveMap) {
          if (specifier.includes(jsrPath)) {
            local = l;
            break;
          }
        }
      }
      if (!local) continue;

      const escapedBare = bare.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const resolvedLocal = local;
      build.onResolve(
        { filter: new RegExp(`^${escapedBare}$`) },
        () => ({ path: resolvedLocal, namespace: ns }),
      );
    }

    build.onResolve({ filter: /^\./, namespace: ns }, (args) => {
      const importerUrl = localToUrl.get(args.importer);
      if (!importerUrl) return undefined;
      const base = importerUrl.substring(
        0,
        importerUrl.lastIndexOf("/") + 1,
      );
      const resolved = base + args.path.replace("./", "");
      const localPath = resolveMap.get(resolved);
      if (localPath) return { path: localPath, namespace: ns };
      return undefined;
    });

    build.onLoad({ filter: /.*/, namespace: ns }, async (args) => ({
      contents: await Deno.readTextFile(args.path),
      loader: "ts",
    }));
  },
});

const entryPoints = ["client/index.ts", "server/local.ts"];

export const buildOptions = async (
  env: "dev" | "prod",
): Promise<BuildOptions> => {
  const denoJson = JSON.parse(await Deno.readTextFile("deno.json"));
  const imports: Record<string, string> = denoJson.imports ?? {};

  const resolveMap = await buildDenoResolveMap(entryPoints);
  console.log(`[Build] Mapped ${resolveMap.size} remote modules`);

  return {
    bundle: true,
    target: "chrome123",
    format: "esm",
    entryPoints,
    outdir: "dist",
    entryNames: "[name]-[hash]",
    sourcemap: true,
    metafile: true,
    plugins: [
      assetInlinePlugin,
      denoRemotePlugin(resolveMap, getRemoteImports(imports)),
    ],
    alias: buildAliasFromImportMap(imports),
    jsx: "automatic",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
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
  await ensureDir(destDir);
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
  await ensureDir("dist");

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
    await ensureDir("dist");
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
