import { z } from "npm:zod";
import { setServer } from "./client.ts";

let worker: SharedWorker | undefined;

let channel: BroadcastChannel | undefined;
let sharedBlobURL: string | undefined;
const zLocalBlobMessage = z.union([
  z.object({
    type: z.literal("blobUrl"),
    url: z.string(),
  }),
  z.object({ type: z.literal("request") }),
]);

const initChannel = () => {
  if (!channel) {
    channel = new BroadcastChannel("local-blob");
    channel.addEventListener("message", (e) => {
      const message = zLocalBlobMessage.parse(e.data);
      if (message.type === "blobUrl") {
        sharedBlobURL = message.url;
        if (!worker) {
          worker = new SharedWorker(sharedBlobURL, { name: "emoji-sheep-tag" });
        }
      } else if (message.type === "request") {
        if (sharedBlobURL) {
          channel!.postMessage({ type: "blobUrl", url: sharedBlobURL });
        }
      }
    });
    channel.postMessage({ type: "request" });
  }
};

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
  private port: MessagePort;
  private id: number;
  private openTimeout: number | undefined;

  constructor() {
    initChannel();
    if (!worker) loadLocal();
    this.port = worker!.port;
    this.port.addEventListener("message", (e) => this.onMessage(e));

    this.id = Math.random();
    this.port.postMessage({ type: "connect", id: this.id });

    this.openTimeout = setTimeout(() => {
      this.openTimeout = undefined;
      this.readyState = 1; // OPEN
      this.dispatchEvent("open", {});
    }, 0);

    globalThis.addEventListener(
      "beforeunload",
      () => {
        this.port.postMessage({ type: "close", id: this.id });
        this.port.close();
      },
    );
  }

  send(data: string) {
    if (this.readyState !== 1) {
      throw new Error("WebSocket is not open");
    }
    this.port.postMessage({ type: "message", id: this.id, data });
  }

  close() {
    if (this.readyState === 3) return;

    // Clear any pending open timeout
    if (this.openTimeout) {
      clearTimeout(this.openTimeout);
      this.openTimeout = undefined;
    }

    this.readyState = 3; // CLOSED
    this.port.postMessage({ type: "close", id: this.id });
    this.dispatchEvent("close", {});
    this.port.close();
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

let started = false;
export const loadLocal = () => {
  initChannel();
  if (!worker) {
    const workerScript = document.querySelector("script#worker")?.textContent;
    if (!workerScript) throw new Error("Could not locate worker script");
    const blob = new Blob([workerScript], { type: "application/javascript" });
    sharedBlobURL = URL.createObjectURL(blob);
    channel!.postMessage({ type: "blobUrl", url: sharedBlobURL });
    worker = new SharedWorker(sharedBlobURL, { name: "emoji-sheep-tag" });
  }
  if (!started) {
    worker.port.start();
    started = true;
  }
  setServer("local");
};

// Test utility to clean up local resources
export const __testing_cleanup_local = () => {
  if (worker) {
    worker.port.close();
    worker = undefined;
  }
  started = false;
  if (sharedBlobURL) {
    URL.revokeObjectURL(sharedBlobURL);
    sharedBlobURL = undefined;
  }
  if (channel) {
    channel.close();
    channel = undefined;
  }
};
