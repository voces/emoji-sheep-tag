import { ensureDir } from "@std/fs";
import esbuild, { type Plugin } from "esbuild";
import { denoPlugins } from "@luca/esbuild-deno-loader";
import { join, relative } from "@std/path";
import { processSoundAssets } from "./processSoundAssets.ts";

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

const copyMaps = async () => {
  const srcDir = "shared/maps";
  const destDir = "dist/maps";
  await ensureDir(destDir);
  for await (const entry of Deno.readDir(srcDir)) {
    if (!entry.isFile || !entry.name.endsWith(".json")) continue;
    await Deno.copyFile(`${srcDir}/${entry.name}`, `${destDir}/${entry.name}`);
  }
};

const cleanOldBundles = async () => {
  try {
    for await (const entry of Deno.readDir("dist")) {
      if (
        entry.isFile &&
        /^(index|local)-.*\.js(\.map)?$/.test(entry.name)
      ) await Deno.remove(`dist/${entry.name}`);
    }
  } catch { /* dist doesn't exist yet */ }
};

const buildJs = async (env: "dev" | "prod") => {
  await ensureDir("dist");
  await cleanOldBundles();

  const result = await esbuild.build({
    bundle: true,
    target: "chrome123",
    format: "esm",
    entryPoints: ["client/index.ts", "server/local.ts"],
    outdir: "dist",
    entryNames: "[name]-[hash]",
    sourcemap: true,
    metafile: true,
    plugins: [
      assetInlinePlugin,
      // Type-incompatible after upgrade, but still functions
      // deno-lint-ignore no-explicit-any
      ...denoPlugins({ configPath: await Deno.realPath("deno.json") }) as any,
    ],
    jsx: "automatic",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    jsxImportSource: "npm:react",
    define: {
      "process.env.NODE_ENV": JSON.stringify(
        env === "dev" ? "development" : "production",
      ),
      "process.env.BUILD_TIME": JSON.stringify(new Date().toISOString()),
    },
    minify: env !== "dev",
  });

  const filenames = { index: "index.js", local: "local.js" };
  for (const output of Object.keys(result.metafile!.outputs)) {
    const basename = output.replace("dist/", "");
    if (basename.startsWith("index-") && basename.endsWith(".js")) {
      filenames.index = basename;
    } else if (basename.startsWith("local-") && basename.endsWith(".js")) {
      filenames.local = basename;
    }
  }

  return filenames;
};

const copyHtml = async (filenames: { index: string; local: string }) => {
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
    const [filenames] = await Promise.all([
      buildJs(env),
      processSoundAssets(),
      copyMaps(),
    ]);
    await copyHtml(filenames);

    console.log(
      "[Build] Built in",
      Math.round(performance.now() - start),
      "ms!",
    );
  } finally {
    // Always stop esbuild service to prevent orphaned processes
    await esbuild.stop();
  }
};

if (import.meta.main) await build(Deno.args.includes("--dev") ? "dev" : "prod");
