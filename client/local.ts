import { z } from "zod";
import { setServer } from "./connection.ts";

let worker: SharedWorker | undefined;

const localJs = (globalThis as unknown as { __LOCAL_JS?: string }).__LOCAL_JS ??
  "local.js";

// LocalWebSocket.ts
type SocketEventMap = {
  close: unknown;
  error: unknown;
  message: { data: unknown };
  open: unknown;
};

const zWorkerMessage = z.object({
  type: z.union([z.literal("message"), z.literal("close"), z.literal("error")]),
  data: z.unknown(),
});

export class LocalWebSocket {
  readyState: number = 0; // CONNECTING
  // deno-lint-ignore ban-types
  private eventListeners: { [key: string]: Function[] } = {};
  private port: MessagePort | undefined;
  private portListener: ((e: MessageEvent) => void) | undefined;
  private id: number;
  private openTimeout: number | undefined;
  private name: string | undefined;

  constructor(name?: string) {
    this.name = name;
    this.id = Math.random();

    if (!worker) loadLocal();
    if (worker) this.initializePort();
  }

  private initializePort() {
    this.port = worker!.port;
    this.portListener = (e: MessageEvent) => this.onMessage(e);
    this.port.addEventListener("message", this.portListener);
    this.port.postMessage({ type: "connect", id: this.id, name: this.name });

    this.openTimeout = setTimeout(() => {
      this.openTimeout = undefined;
      this.readyState = 1; // OPEN
      this.dispatchEvent("open", {});
    }, 0);

    globalThis.addEventListener(
      "beforeunload",
      () => {
        if (this.port) {
          this.port.postMessage({ type: "close", id: this.id });
          this.port.close();
        }
      },
    );
  }

  send(data: string) {
    if (this.readyState !== 1) {
      throw new Error("WebSocket is not open");
    }
    if (!this.port) {
      throw new Error("WebSocket port not initialized");
    }
    this.port.postMessage({ type: "message", id: this.id, data });
  }

  close() {
    if (this.readyState === 3) return;

    if (this.openTimeout) {
      clearTimeout(this.openTimeout);
      this.openTimeout = undefined;
    }

    this.readyState = 3; // CLOSED
    if (this.port) {
      this.port.postMessage({ type: "close", id: this.id });
      if (this.portListener) {
        this.port.removeEventListener("message", this.portListener);
        this.portListener = undefined;
      }
    }
    this.dispatchEvent("close", {});
  }

  addEventListener<K extends keyof SocketEventMap>(
    type: K,
    listener: (ev: SocketEventMap[K]) => void,
  ) {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push(listener);
  }

  private dispatchEvent<K extends keyof SocketEventMap>(
    type: K,
    event: SocketEventMap[K],
  ) {
    if (this.eventListeners[type]) {
      this.eventListeners[type].forEach((listener) =>
        listener.call(this, event)
      );
    }
  }

  private onMessage(event: MessageEvent) {
    const data = zWorkerMessage.parse(event.data);

    switch (data.type) {
      case "message":
        this.dispatchEvent("message", { data: data.data });
        break;
      case "close":
        this.readyState = 3; // CLOSED
        this.dispatchEvent("close", {});
        break;
      case "error":
        this.dispatchEvent("error", {});
        break;
    }
  }
}

const createWorker = (): SharedWorker =>
  new SharedWorker(localJs, { name: "emoji-sheep-tag", type: "module" });

export const loadLocal = () => {
  if (!worker) {
    worker = createWorker();
    worker.port.start();
  }

  setServer("local");
};

export const __testing_cleanup_local = () => {
  if (worker) {
    worker.port.close();
    worker = undefined;
  }
};
