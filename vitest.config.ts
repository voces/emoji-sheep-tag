import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const denoJson = JSON.parse(readFileSync("deno.json", "utf8"));

/**
 * Deno's `with { type: "text" | "bytes" }` imports: text becomes Vite's `?raw`
 * and bytes a `?bytes` import this plugin loads as a Uint8Array.
 */
const rawImports = (): Plugin => ({
  name: "raw-imports",
  enforce: "pre",
  transform(code, id) {
    if (!/\.[jt]sx?$/.test(id) || !code.includes(" with { type: ")) return;
    return code.replace(
      /from "([^"]+)" with \{ type: "(text|bytes)" \}/g,
      (_, path, type) => `from "${path}?${type === "text" ? "raw" : "bytes"}"`,
    );
  },
  load(id) {
    if (!id.endsWith("?bytes")) return;
    const bytes = readFileSync(id.slice(0, -"?bytes".length));
    return `export default Uint8Array.from(atob("${
      bytes.toString("base64")
    }"), (c) => c.charCodeAt(0));`;
  },
});

export default defineConfig({
  plugins: [rawImports()],
  resolve: {
    alias: Object.entries(denoJson.imports as Record<string, string>).map((
      [find, to],
    ) => ({
      find: find.replace(/\/$/, ""),
      replacement: new URL(to, import.meta.url).pathname.replace(/\/$/, ""),
    })),
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "client",
          include: ["client/**/*.test.{ts,tsx}"],
          // The client is browser code and expects window globals
          environment: "jsdom",
          setupFiles: ["client/testing/environment.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "server",
          include: ["{server,shared,scripts}/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
