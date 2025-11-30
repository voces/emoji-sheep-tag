import { makeVar } from "@/hooks/useVar.tsx";
import type { CaptainsDraft } from "../../schemas.ts";

export const captainsDraftVar = makeVar<CaptainsDraft>(undefined);
