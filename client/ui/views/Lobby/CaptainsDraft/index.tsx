import { useReactiveVar } from "@/hooks/useVar.tsx";
import { captainsDraftVar } from "@/vars/captainsDraft.ts";
import { DraftContainer, DraftHeader } from "./styles.tsx";
import { SelectingCaptains } from "./SelectingCaptains.tsx";
import { Drafting } from "./Drafting.tsx";

export const CaptainsDraft = () => {
  const draft = useReactiveVar(captainsDraftVar);

  if (!draft) return null;

  return (
    <DraftContainer>
      <DraftHeader>Captains Draft</DraftHeader>
      {draft.phase === "selecting-captains" && <SelectingCaptains />}
      {draft.phase === "drafting" && <Drafting />}
    </DraftContainer>
  );
};
