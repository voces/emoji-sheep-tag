import { serveFile } from "jsr:@std/http/file-server";
import { resolve } from "jsr:@std/path";
import { handleSocket } from "./client.ts";
import { startWatchdog } from "./watchdog.ts";
import { ensureDir } from "jsr:@std/fs";

const isDev = Deno.args.includes("--dev");

if (isDev) {
  import("../scripts/dev.ts");
  await ensureDir("dist");
} else await (await import("../scripts/build.ts")).build("prod");

const dist = await Deno.realPath("dist");

const rawPort = Deno.env.get("PORT");
const port = rawPort ? parseInt(rawPort) : undefined;

Deno.serve({
  port,
  onListen: async (path) => {
    await startWatchdog();
    console.log(
      `[Server] Server ready on port ${path.transport}://${path.hostname}:${path.port}`,
    );
  },
}, async (req) => {
  const url = new URL(req.url);

  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);
    handleSocket(socket);
    return response;
  }

  const filepath = resolve(dist, url.pathname.slice(1));
  if (
    url.pathname === "/" ||
    (await Deno.lstat(filepath).catch(() => undefined) &&
      filepath.startsWith(dist))
  ) {
    return serveFile(req, url.pathname === "/" ? "dist/index.html" : filepath);
  }

  return new Response(undefined, { status: 404 });
});
