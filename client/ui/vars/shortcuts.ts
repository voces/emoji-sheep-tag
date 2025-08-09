import { makeVar } from "@/hooks/useVar.tsx";
import {
  createInitialShortcuts,
  type Shortcuts,
} from "@/util/shortcutUtils.ts";

export const shortcutsVar = makeVar<Shortcuts>(createInitialShortcuts());
