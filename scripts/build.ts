import jsdom from "jsdom";
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

const decoder = new TextDecoder();

const copyMaps = async () => {
  const srcDir = "shared/maps";
  const destDir = "dist/maps";
  await ensureDir(destDir);
  for await (const entry of Deno.readDir(srcDir)) {
    if (!entry.isFile || !entry.name.endsWith(".json")) continue;
    await Deno.copyFile(`${srcDir}/${entry.name}`, `${destDir}/${entry.name}`);
  }
};

const buildHtml = async (env: "dev" | "prod") => {
  // Load HTML first (needed for subsequent steps)
  const dom = new jsdom.JSDOM(
    await Deno.readTextFile("./client/index.html"),
  );
  const document: Document = dom.window.document;

  const main = document.querySelector("script#main");
  if (!main) throw new Error("Could not find main script");

  const worker = document.querySelector("script#worker");
  if (!worker) throw new Error("Could not find worker script");

  // Run esbuild and ensure dist directory in parallel
  const [files] = await Promise.all([
    // esbuild bundling
    esbuild.build({
      bundle: true,
      target: "chrome123",
      format: "esm",
      entryPoints: ["client/index.ts", "server/local.ts"],
      write: false,
      publicPath: "/",
      sourcemap: env === "dev" ? "inline" : false,
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
      outdir: "dist",
      define: {
        "process.env.NODE_ENV": JSON.stringify(
          env === "dev" ? "development" : "production",
        ),
      },
      minify: env === "dev" ? false : true,
    }),
    ensureDir("dist"),
  ]);

  main.textContent = decoder.decode(files.outputFiles[0].contents);
  worker.textContent = decoder.decode(files.outputFiles[1].contents);

  // Write HTML file as final step (can't be parallelized with DOM manipulation above)
  await Deno.writeTextFile("dist/index.html", dom.serialize());
};

export const build = async (env: "dev" | "prod") => {
  const start = performance.now();

  try {
    // Run HTML/JS building and sound asset copying in true parallel
    await Promise.all([
      buildHtml(env),
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
