import { z } from "npm:zod";
import { makeVar } from "@/hooks/useVar.tsx";
import { zFormat } from "../../client.ts";

export const formatVar = makeVar<z.TypeOf<typeof zFormat>>({
  sheep: 1,
  wolves: 0,
});
