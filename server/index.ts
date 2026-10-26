import { lstat, mkdir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { handleSocket } from "./client.ts";
import { handleShardSocket } from "./shardRegistry.ts";
import { startWatchdog } from "./platform/watchdog.ts";
import { serve, serveFile } from "./platform/serve.ts";
import { args, env } from "./platform/env.ts";
import { handleStatusRoute, isPageLoad } from "./status/handlers.ts";
import { getPlayerCount } from "./status/sse.ts";
import { incrementPageLoads } from "./status/storage.ts";
import { startFlyReconciliation } from "./flyMachines.ts";
import { buildLobbyMetaTags } from "./lobbyMeta.ts";

const isDev = args.includes("--dev");

if (isDev) {
  import("../scripts/dev.ts");
  await mkdir("dist", { recursive: true });
} else await (await import("../scripts/build.ts")).build("prod");

const dist = await realpath("dist");

const rawPort = env("PORT");
const port = rawPort ? parseInt(rawPort) : undefined;

serve({
  port,
  onListen: async ({ hostname, port }) => {
    await startWatchdog();
    startFlyReconciliation();
    console.log(`[Server] Server ready on http://${hostname}:${port}`);
  },
}, async (req, connection) => {
  const url = new URL(req.url);

  if (req.headers.get("upgrade") === "websocket") {
    // Read request headers before upgrading; the request is unusable after
    const remoteIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      connection.remoteAddress;
    const isSecure = url.protocol === "https:" ||
      req.headers.get("x-forwarded-proto") === "https";
    const { socket, response } = connection.upgradeWebSocket();
    // Route shard connections to shard handler
    if (url.pathname === "/shard") {
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
    (await lstat(filepath).catch(() => undefined) &&
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
