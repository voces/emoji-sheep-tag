import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { type WebSocket, WebSocketServer } from "ws";

export type TestWsServer = {
  port: number;
  close: () => Promise<void>;
};

/**
 * A WebSocket server for tests on an ephemeral port, listening on every
 * interface so both `localhost` and `127.0.0.1` reach it. An upgrade to a path
 * `accept` rejects is answered with a 404.
 */
export const startWsServer = async ({ accept, onConnection }: {
  accept?: (url: URL) => boolean;
  onConnection?: (socket: WebSocket) => void;
} = {}): Promise<TestWsServer> => {
  const http = createServer((_, res) => res.writeHead(501).end());
  const wss = new WebSocketServer({ noServer: true });
  http.on("upgrade", (req, socket, head) => {
    if (accept && !accept(new URL(req.url ?? "/", "http://localhost"))) {
      socket.end("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n");
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => onConnection?.(ws));
  });
  await new Promise<void>((resolve) => http.listen(0, resolve));

  return {
    port: (http.address() as AddressInfo).port,
    close: () =>
      new Promise((resolve) => {
        for (const client of wss.clients) client.terminate();
        wss.close();
        http.close(() => resolve());
      }),
  };
};
