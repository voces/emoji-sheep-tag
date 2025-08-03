declare const self: SharedWorkerGlobalScope;

import { handleSocket } from "./client.ts";

type SocketEventMap = {
  close: unknown;
  error: unknown;
  message: { data: unknown };
  open: unknown;
};

type Socket = {
  readyState: number;
  send: (data: string) => void;
  close: () => void;
  addEventListener: <K extends keyof SocketEventMap>(
    type: K,
    listener: (this: Socket, ev: SocketEventMap[K]) => void,
  ) => void;
  dispatchEvent: <K extends keyof SocketEventMap>(
    type: K,
    event: SocketEventMap[K],
  ) => void;
};

interface ClientInfo {
  id: number;
  port: MessagePort;
  socket: Socket;
}

const clients: Map<number, ClientInfo> = new Map();

self.onconnect = (e) => {
  const port = e.ports[0];
  port.start();

  // let timeout = setTimeout(() => {
  //   client.socket.close();
  // }, 5000);

  port.onmessage = (event) => {
    const data = event.data;
    const client = clients.get(data.id);

    switch (data.type) {
      case "connect": {
        const id = data.id;
        const socket = createSocket(id, port);
        clients.set(id, { id, port, socket });
        handleSocket(socket);
        socket.dispatchEvent("open", undefined);
        break;
      }
      case "message": {
        if (client) {
          client.socket.dispatchEvent("message", { data: data.data });
        }
        break;
      }
      case "close": {
        if (client) {
          client.socket.close();
          clients.delete(data.id);
        }
        break;
      }
    }
  };
};

const createSocket = (id: number, port: MessagePort) => {
  let readyState: number = WebSocket.OPEN;
  // deno-lint-ignore ban-types
  const eventListeners: { [key: string]: Function[] } = {};

  const dispatchEvent = (type: string, event: unknown) => {
    if (eventListeners[type]) {
      eventListeners[type].forEach((listener) => listener.call(socket, event));
    }
  };

  const socket: Socket = {
    readyState,
    send: (data: string) => {
      port.postMessage({ type: "message", id, data });
    },
    close: () => {
      if (readyState === WebSocket.CLOSED) return;
      readyState = WebSocket.CLOSED;
      port.postMessage({ type: "close", id });
      dispatchEvent("close", {});
    },
    addEventListener: (type, listener) => {
      if (!eventListeners[type]) eventListeners[type] = [];
      eventListeners[type].push(listener);
    },
    dispatchEvent,
  };

  return socket;
};
