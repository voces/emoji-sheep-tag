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

const buildJs = async (env: "dev" | "prod") => {
  await ensureDir("dist");

  await esbuild.build({
    bundle: true,
    target: "chrome123",
    format: "esm",
    entryPoints: ["client/index.ts", "server/local.ts"],
    outdir: "dist",
    entryNames: "[name]",
    sourcemap: true,
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
    },
    minify: env !== "dev",
  });
};

const copyHtml = async () => {
  await Deno.copyFile("client/index.html", "dist/index.html");
};

export const build = async (env: "dev" | "prod") => {
  const start = performance.now();

  try {
    await Promise.all([
      buildJs(env),
      copyHtml(),
      processSoundAssets(),
      copyMaps(),
    ]);

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
