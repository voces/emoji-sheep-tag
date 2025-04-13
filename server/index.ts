import { serveFile } from "jsr:@std/http/file-server";
import { resolve } from "jsr:@std/path";
import { handleSocket } from "./client.ts";

const isDev = Deno.args.includes("--dev");

if (isDev) import("../scripts/dev.ts");
else await (await import("../scripts/build.ts")).build();

const dist = await Deno.realPath("dist");

const rawPort = Deno.env.get("PORT");
const port = rawPort ? parseInt(rawPort) : undefined;

Deno.serve({ port }, async (req) => {
  const url = new URL(req.url);
  const { pathname } = url;
  const filepath = resolve(dist, pathname.slice(1));
  if (
    pathname === "/" ||
    (await Deno.lstat(filepath).catch(() => undefined) &&
      filepath.startsWith(dist))
  ) {
    return serveFile(req, pathname === "/" ? "dist/index.html" : filepath);
  }

  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade !== "websocket") new Response(undefined, { status: 404 });

  const { socket, response } = Deno.upgradeWebSocket(req);
  handleSocket(socket);
  return response;
});
