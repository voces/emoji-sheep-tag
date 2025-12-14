import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";
import { useEffect, useRef, useState } from "react";

export const useSet = (set: ExtendedSet<unknown>) => {
  const [, next] = useState(0);
  const pendingUpdate = useRef(false);

  useEffect(() => {
    const scheduleUpdate = () => {
      if (!pendingUpdate.current) {
        pendingUpdate.current = true;
        // Use setTimeout(0) instead of queueMicrotask to defer until after React's render cycle
        setTimeout(() => {
          pendingUpdate.current = false;
          next((p) => p + 1);
        }, 0);
      }
    };

    const clearAdd = set.addEventListener("add", scheduleUpdate);
    const clearDelete = set.addEventListener("delete", scheduleUpdate);

    return () => {
      clearAdd();
      clearDelete();
    };
  }, []);
};
