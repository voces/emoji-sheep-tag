import jsdom from "jsdom";
import { ensureDir } from "jsr:@std/fs";
import esbuild, { type Plugin } from "npm:esbuild";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader";
import { isAbsolute, join } from "jsr:@std/path";

const textPlugin = {
  name: "text",
  setup(build) {
    build.onResolve(
      { filter: /\.svg$/ },
      async (args) => ({ path: args.path, namespace: "text" }),
    );
    build.onLoad({ filter: /\.svg$/, namespace: "text" }, async (args) => ({
      contents: await Deno.readTextFile(join("client", args.path)),
      loader: "text",
    }));
  },
} satisfies Plugin;

export const build = async () => {
  const start = performance.now();

  const dom = new jsdom.JSDOM(
    await Deno.readTextFile("./client/index.html"),
  );

  const document: Document = dom.window.document;

  const script = document.querySelector('script[src="main.js"]');

  if (!script) throw new Error("Could not find main script");

  script.removeAttribute("src");
  script.textContent = new TextDecoder().decode(
    (await esbuild.build({
      bundle: true,
      target: "chrome123",
      format: "esm",
      entryPoints: ["client/index.ts"],
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
    })).outputFiles[0].contents,
  );

  await ensureDir("dist");

  await Deno.writeTextFile("dist/index.html", dom.serialize());

  console.log("Built in", Math.round(performance.now() - start), "ms!");
};

if (import.meta.main) await build();
