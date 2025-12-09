import { serveFile } from "@std/http/file-server";
import { resolve } from "@std/path";
import { handleSocket } from "./client.ts";
import { handleShardSocket } from "./shardRegistry.ts";
import { startWatchdog } from "./watchdog.ts";
import { ensureDir } from "@std/fs";

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
}, async (req, info) => {
  const url = new URL(req.url);

  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);
    // Route shard connections to shard handler
    if (url.pathname === "/shard") {
      const remoteIp =
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
          req.headers.get("x-real-ip") ??
          info.remoteAddr.hostname;
      const isSecure = url.protocol === "https:" ||
        req.headers.get("x-forwarded-proto") === "https";
      handleShardSocket(socket, remoteIp, isSecure);
    } else {
      handleSocket(socket, url);
    }
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
