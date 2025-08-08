import jsdom from "jsdom";
import { copy, ensureDir } from "jsr:@std/fs";
import esbuild, { type Plugin } from "npm:esbuild";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader";
import { basename, join, relative } from "jsr:@std/path";
import { expandGlob } from "jsr:@std/fs";

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

// Copy sound assets from client/assets to dist/assets
const copySoundAssets = async () => {
  const assetsDir = "dist/assets";
  await ensureDir(assetsDir);

  // Collect all mp3 files first
  const soundFiles = [];
  for await (const entry of expandGlob("client/assets/*.mp3")) {
    if (entry.isFile) soundFiles.push(entry.path);
  }

  // Copy all files in parallel
  await Promise.all(
    soundFiles.map((filePath) => {
      const fileName = basename(filePath);
      return copy(filePath, join(assetsDir, fileName), { overwrite: true });
    }),
  );
};

const decoder = new TextDecoder();

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

  // Run HTML/JS building and sound asset copying in true parallel
  await Promise.all([
    buildHtml(env),
    copySoundAssets(),
  ]);

  console.log("Built in", Math.round(performance.now() - start), "ms!");
};

if (import.meta.main) await build(Deno.args.includes("--dev") ? "dev" : "prod");
