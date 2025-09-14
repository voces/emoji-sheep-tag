import { ExtendedSet } from "@/shared/util/ExtendedSet.ts";
import { useEffect, useState } from "react";

export const useSet = (set: ExtendedSet<unknown>) => {
  const [, next] = useState(0);

  useEffect(() => {
    const clearAdd = set.addEventListener("add", () => next((p) => p + 1));

    const clearDelete = set.addEventListener(
      "delete",
      () => next((p) => p + 1),
    );

    return () => {
      clearAdd();
      clearDelete();
    };
  }, []);
};
