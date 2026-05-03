import { serveFile } from "@std/http/file-server";
import { resolve } from "@std/path";
import { handleSocket } from "./client.ts";
import { handleShardSocket } from "./shardRegistry.ts";
import { startWatchdog } from "./watchdog.ts";
import { ensureDir } from "@std/fs";
import { handleStatusRoute, isPageLoad } from "./status/handlers.ts";
import { getPlayerCount } from "./status/sse.ts";
import { incrementPageLoads } from "./status/storage.ts";
import { startFlyReconciliation } from "./flyMachines.ts";
import { buildLobbyMetaTags } from "./lobbyMeta.ts";

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
    startFlyReconciliation();
    console.log(
      `[Server] Server ready on port ${path.transport}://${path.hostname}:${path.port}`,
    );
  },
}, async (req, info) => {
  const url = new URL(req.url);

  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);
    // Route shard connections to shard handler
    const remoteIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      info.remoteAddr.hostname;
    if (url.pathname === "/shard") {
      const isSecure = url.protocol === "https:" ||
        req.headers.get("x-forwarded-proto") === "https";
      handleShardSocket(socket, remoteIp, isSecure);
    } else {
      handleSocket(socket, url, remoteIp);
    }
    return response;
  }

  if (req.method === "GET" && isPageLoad(url.pathname)) {
    incrementPageLoads().catch((err) =>
      console.error("[status] incrementPageLoads failed:", err)
    );
  }

  const statusResponse = await handleStatusRoute(req, url);
  if (statusResponse) return statusResponse;

  const filepath = resolve(dist, url.pathname.slice(1));
  if (
    url.pathname === "/" ||
    (await Deno.lstat(filepath).catch(() => undefined) &&
      filepath.startsWith(dist))
  ) {
    const response = await serveFile(
      req,
      url.pathname === "/" ? "dist/index.html" : filepath,
    );
    if (url.pathname === "/" || url.pathname === "/index.html") {
      response.headers.set("cache-control", "no-cache");
      if (response.status === 200) {
        const html = await response.text();
        const lobbyParam = url.searchParams.get("lobby");
        const meta = buildLobbyMetaTags(url, lobbyParam);
        const injected = html.replace(
          "</head>",
          `<meta name="player-count" content="${getPlayerCount()}">\n    ${meta}\n</head>`,
        );
        response.headers.delete("content-length");
        return new Response(injected, {
          status: response.status,
          headers: response.headers,
        });
      }
    } else if (/-[A-Z0-9]{8}\./.test(url.pathname)) {
      response.headers.set(
        "cache-control",
        "public, max-age=31536000, immutable",
      );
    }
    return response;
  }

  return new Response(undefined, { status: 404 });
});
