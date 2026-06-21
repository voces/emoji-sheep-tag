import { makeVar } from "@/hooks/useVar.tsx";

// Monotonic counter bumped whenever the server reports a round failed to start
// (e.g. a shard failed to boot). Subscribers use the change as a signal to
// clear any pending start state.
export const startFailedVar = makeVar<number>(0);
