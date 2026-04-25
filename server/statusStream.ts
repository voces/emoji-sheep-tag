const handlers = new Set<() => void>();

export const onStatusChange = (handler: () => void) => {
  handlers.add(handler);
  return () => handlers.delete(handler);
};

export const notifyStatusChange = () => {
  for (const handler of handlers) {
    try {
      handler();
    } catch (err) {
      console.error("[status] handler failed:", err);
    }
  }
};

export type RoundEndedEvent = {
  lobby: string;
  mode: string;
  sheep: string[];
  wolves: string[];
  durationMs: number;
  endedAt: number;
};

const roundHandlers = new Set<(event: RoundEndedEvent) => void>();

export const onRoundEnded = (handler: (event: RoundEndedEvent) => void) => {
  roundHandlers.add(handler);
  return () => roundHandlers.delete(handler);
};

export const emitRoundEnded = (event: RoundEndedEvent) => {
  for (const handler of roundHandlers) {
    try {
      handler(event);
    } catch (err) {
      console.error("[status] round handler failed:", err);
    }
  }
};
