import jsdom from "jsdom";
import { copy, ensureDir } from "jsr:@std/fs";
import esbuild, { type Plugin } from "npm:esbuild";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader";
import { basename, join, relative } from "jsr:@std/path";

const assetInlinePlugin = {
  name: "asset-inline",
  setup(build) {
    build.onResolve(
      { filter: /\.svg$/ },
      async (args) => ({
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

export const assetCopyPlugin = {
  name: "asset-copy",
  setup(build) {
    build.onResolve({ filter: /\.(mp3|wav|ogg)$/ }, (args) => ({
      path: relative(Deno.cwd(), join(args.resolveDir, args.path)),
      namespace: "asset-copy",
    }));

    build.onLoad(
      { filter: /.*/, namespace: "asset-copy" },
      async (args) => {
        const outdir = build.initialOptions.outdir || "dist";
        const destDir = join(outdir, "assets");
        const fileName = basename(args.path);

        await Deno.mkdir(destDir, { recursive: true });
        await copy(args.path, join(destDir, fileName), { overwrite: true });

        return {
          contents: `./assets/${fileName}`,
          loader: "text",
        };
      },
    );
  },
} satisfies Plugin;

const decoder = new TextDecoder();

export const build = async () => {
  const start = performance.now();

  const dom = new jsdom.JSDOM(
    await Deno.readTextFile("./client/index.html"),
  );

  const document: Document = dom.window.document;

  const main = document.querySelector("script#main");
  if (!main) throw new Error("Could not find main script");

  const worker = document.querySelector("script#worker");
  if (!worker) throw new Error("Could not find worker script");

  const files = (await esbuild.build({
    bundle: true,
    target: "chrome123",
    format: "esm",
    entryPoints: ["client/index.ts", "server/local.ts"],
    write: false,
    sourcemap: "inline",
    plugins: [
      assetInlinePlugin,
      assetCopyPlugin,
      ...denoPlugins({ configPath: await Deno.realPath("deno.json") }),
    ],
    jsx: "automatic",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    jsxImportSource: "npm:react",
    outdir: "dist",
  })).outputFiles;

  main.textContent = decoder.decode(files[0].contents);
  worker.textContent = decoder.decode(files[1].contents);

  await ensureDir("dist");

  await Deno.writeTextFile("dist/index.html", dom.serialize());

  console.log("Built in", Math.round(performance.now() - start), "ms!");
};

if (import.meta.main) await build();
