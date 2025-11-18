import { makeVar } from "@/hooks/useVar.tsx";

// Counter that increments whenever local maps should be refreshed
export const localMapsRefreshVar = makeVar<number>(0);

export const triggerLocalMapsRefresh = () => {
  localMapsRefreshVar((prev) => prev + 1);
};
