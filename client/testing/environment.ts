import { WebSocket } from "ws";

// jsdom's WebSocket dispatches events built from the environment's Event
// class, which Node's EventTarget rejects; ws implements its own events.
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
