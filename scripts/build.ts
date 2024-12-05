import jsdom from "jsdom";
import { ensureDir } from "jsr:@std/fs";
import esbuild, { type Plugin } from "npm:esbuild";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader";
import { join, relative } from "jsr:@std/path";

const textPlugin = {
  name: "text",
  setup(build) {
    build.onResolve(
      { filter: /\.svg$/ },
      async (args) => ({
        path: relative(Deno.cwd(), join(args.resolveDir, args.path)),
        namespace: "text",
      }),
    );
    build.onLoad({ filter: /\.svg$/, namespace: "text" }, async (args) => ({
      contents: await Deno.readTextFile(args.path),
      loader: "text",
    }));
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
      textPlugin,
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

  // script.textContent = new TextDecoder().decode(
  //   (await esbuild.build({
  //     bundle: true,
  //     target: "chrome123",
  //     format: "esm",
  //     entryPoints: ["client/index.ts"],
  //     write: false,
  //     sourcemap: "inline",
  //     plugins: [
  //       textPlugin,
  //       ...denoPlugins({ configPath: await Deno.realPath("deno.json") }),
  //     ],
  //     jsx: "automatic",
  //     jsxFactory: "React.createElement",
  //     jsxFragment: "React.Fragment",
  //     jsxImportSource: "npm:react",
  //   })).outputFiles[0].contents,
  // );

  await ensureDir("dist");

  await Deno.writeTextFile("dist/index.html", dom.serialize());

  console.log("Built in", Math.round(performance.now() - start), "ms!");
};

if (import.meta.main) await build();
