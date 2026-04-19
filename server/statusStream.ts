import { getAllClients } from "./client.ts";
import { lobbies } from "./lobby.ts";

const encoder = new TextEncoder();
const controllers = new Set<ReadableStreamDefaultController>();

export const getPlayerCount = () => getAllClients().size;
export const getLobbyCount = () => lobbies.size;

const broadcast = () => {
  const data = JSON.stringify({
    players: getPlayerCount(),
    lobbies: getLobbyCount(),
  });
  for (const controller of controllers) {
    try {
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    } catch (err) {
      console.error(err);
      controllers.delete(controller);
    }
  }
};

export const notifyStatusChange = () => broadcast();

export const createStatusStream = () => {
  let ctrl: ReadableStreamDefaultController;
  const body = new ReadableStream({
    start(controller) {
      ctrl = controller;
      controllers.add(ctrl);
      const data = JSON.stringify({
        players: getPlayerCount(),
        lobbies: getLobbyCount(),
      });
      ctrl.enqueue(encoder.encode(`data: ${data}\n\n`));
    },
    cancel() {
      controllers.delete(ctrl);
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "connection": "keep-alive",
    },
  });
};
