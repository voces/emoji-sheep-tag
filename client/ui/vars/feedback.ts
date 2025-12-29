import { makeVar } from "@/hooks/useVar.tsx";

export const feedbackVar = makeVar<string | undefined>(undefined);

let feedbackTimeout: number | undefined;

export const showFeedback = (message: string) => {
  if (feedbackTimeout) clearTimeout(feedbackTimeout);

  feedbackVar(message);

  // Duration based on text length: min 1.5s, ~50ms per character, max 4s
  const duration = Math.min(4000, Math.max(1500, message.length * 50));

  feedbackTimeout = setTimeout(() => {
    feedbackVar(undefined);
    feedbackTimeout = undefined;
  }, duration);
};
