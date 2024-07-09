import { serveFile } from "jsr:@std/http/file-server";
import { handleSocket } from "./client.ts";

const isDev = Deno.args.includes("--dev");

if (isDev) import("../scripts/dev.ts");

Deno.serve((req) => {
  const url = new URL(req.url);
  const { pathname } = url;
  if (pathname === "/") return serveFile(req, "dist/index.html");

  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade !== "websocket") new Response(undefined, { status: 404 });

  const { socket, response } = Deno.upgradeWebSocket(req);
  handleSocket(socket);
  return response;
});
