/**
 * The HTTP and WebSocket server, the one place the servers depend on the
 * runtime's own server API. Handlers take a web `Request` and return a web
 * `Response`; a WebSocket upgrade hands back a `ServerSocket`. Runs on Bun,
 * and on Deno until nothing runs the server there.
 */
import type { Socket, SocketEventMap } from "../util/socketHandler.ts";

export { serveFile } from "./serveFile.ts";

export type ServerSocket = Socket & {
  close: (code?: number, reason?: string) => void;
};

export type Connection = {
  remoteAddress: string;
  /**
   * Upgrades the request to a WebSocket; return the response from the handler.
   * Read any request headers first, as the request is unusable afterwards.
   */
  upgradeWebSocket: () => { socket: ServerSocket; response: Response };
};

export type ServeOptions = {
  port?: number;
  onListen?: (address: { hostname: string; port: number }) => void;
};

type Handler = (
  req: Request,
  connection: Connection,
) => Response | Promise<Response>;

type Server = { shutdown: () => Promise<void>; port: number };

type BunSocket = {
  data: BunSocketAdapter;
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

type BunServer = {
  port: number;
  hostname: string;
  upgrade: (req: Request, options: { data: BunSocketAdapter }) => boolean;
  requestIP: (req: Request) => { address: string } | null;
  stop: (closeActiveConnections?: boolean) => Promise<void>;
};

type BunRuntime = {
  serve: (options: {
    port?: number;
    fetch: (
      req: Request,
      server: BunServer,
    ) => Response | undefined | Promise<Response | undefined>;
    websocket: {
      open: (ws: BunSocket) => void;
      message: (ws: BunSocket, message: string | Uint8Array) => void;
      close: (ws: BunSocket, code: number, reason: string) => void;
    };
  }) => BunServer;
};

/** A web-`WebSocket`-shaped view of a Bun server socket. */
class BunSocketAdapter implements ServerSocket {
  readyState: number = WebSocket.CONNECTING;
  private ws?: BunSocket;
  private listeners: {
    [K in keyof SocketEventMap]?: ((ev: SocketEventMap[K]) => void)[];
  } = {};

  addEventListener<K extends keyof SocketEventMap>(
    type: K,
    listener: (this: Socket, ev: SocketEventMap[K]) => void,
  ) {
    const list: ((ev: SocketEventMap[K]) => void)[] = this.listeners[type] ??=
      [];
    list.push(listener.bind(this));
  }

  send(data: string) {
    if (this.readyState === WebSocket.OPEN) this.ws?.send(data);
  }

  private pendingClose?: [code?: number, reason?: string];

  close(code?: number, reason?: string) {
    if (
      this.readyState === WebSocket.CLOSING ||
      this.readyState === WebSocket.CLOSED
    ) return;
    this.readyState = WebSocket.CLOSING;
    if (this.ws) this.ws.close(code, reason);
    else this.pendingClose = [code, reason];
  }

  private dispatch<K extends keyof SocketEventMap>(
    type: K,
    ev: SocketEventMap[K],
  ) {
    for (const listener of this.listeners[type] ?? []) listener(ev);
  }

  private handled = false;

  /**
   * Bun opens the socket inside `upgrade`, before the handler has attached its
   * listeners; `open` waits until both have happened, as on other runtimes.
   */
  private maybeOpen() {
    if (!this.ws || !this.handled || this.readyState !== WebSocket.CONNECTING) {
      return;
    }
    this.readyState = WebSocket.OPEN;
    this.dispatch("open", {});
  }

  opened(ws: BunSocket) {
    this.ws = ws;
    if (this.pendingClose) ws.close(...this.pendingClose);
    this.maybeOpen();
  }

  handlerReturned() {
    this.handled = true;
    this.maybeOpen();
  }

  received(message: string | Uint8Array) {
    this.dispatch("message", {
      data: typeof message === "string" ? message : message.slice().buffer,
    });
  }

  closed(code: number, reason: string) {
    this.readyState = WebSocket.CLOSED;
    this.dispatch("close", { code, reason });
  }
}

const serveBun = (bun: BunRuntime, options: ServeOptions, handler: Handler) => {
  const server = bun.serve({
    port: options.port,
    fetch: async (req, server) => {
      let socket: BunSocketAdapter | undefined;
      const response = await handler(req, {
        remoteAddress: server.requestIP(req)?.address ?? "",
        upgradeWebSocket: () => {
          socket = new BunSocketAdapter();
          if (!server.upgrade(req, { data: socket })) {
            throw new Error("WebSocket upgrade failed");
          }
          return { socket, response: new Response(null) };
        },
      });
      if (!socket) return response;
      socket.handlerReturned();
    },
    websocket: {
      open: (ws) => ws.data.opened(ws),
      message: (ws, message) => ws.data.received(message),
      close: (ws, code, reason) => ws.data.closed(code, reason),
    },
  });
  options.onListen?.({ hostname: server.hostname, port: server.port });
  return { shutdown: () => server.stop(true), port: server.port };
};

const serveDeno = (options: ServeOptions, handler: Handler) => {
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

const bun = (globalThis as { Bun?: BunRuntime }).Bun;

export const serve = (options: ServeOptions, handler: Handler): Server =>
  bun ? serveBun(bun, options, handler) : serveDeno(options, handler);
