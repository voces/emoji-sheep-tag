import { makeVar } from "@/hooks/useVar.tsx";

export const editorVar = makeVar<boolean>(false);
export const editorMapModifiedVar = makeVar<boolean>(false);
export const editorCurrentMapVar = makeVar<
  { id: string; name: string } | undefined
>(undefined);
export const editorHideUIVar = makeVar<boolean>(false);
