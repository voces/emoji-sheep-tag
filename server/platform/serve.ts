/**
 * The HTTP and WebSocket server, the one place the servers depend on the
 * runtime's own server API. Handlers take a web `Request` and return a web
 * `Response`; a WebSocket upgrade hands back a web `WebSocket`.
 */
export { serveFile } from "@std/http/file-server";

export type Connection = {
  remoteAddress: string;
  /**
   * Upgrades the request to a WebSocket; return the response from the handler.
   * Read any request headers first, as the request is unusable afterwards.
   */
  upgradeWebSocket: () => { socket: WebSocket; response: Response };
};

export type ServeOptions = {
  port?: number;
  onListen?: (address: { hostname: string; port: number }) => void;
};

export const serve = (
  options: ServeOptions,
  handler: (
    req: Request,
    connection: Connection,
  ) => Response | Promise<Response>,
): { shutdown: () => Promise<void>; port: number } => {
  const server = Deno.serve({
    port: options.port,
    onListen: ({ hostname, port }) => options.onListen?.({ hostname, port }),
  }, (req, info) =>
    handler(req, {
      remoteAddress: info.remoteAddr.hostname,
      upgradeWebSocket: () => Deno.upgradeWebSocket(req),
    }));
  return { shutdown: () => server.shutdown(), port: server.addr.port };
};
