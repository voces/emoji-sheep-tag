import { useTranslation } from "react-i18next";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { captainsDraftVar } from "@/vars/captainsDraft.ts";
import { DraftHeader, DraftPanel, DraftTitle } from "./styles.tsx";
import { SelectingCaptains } from "./SelectingCaptains.tsx";
import { Drafting } from "./Drafting.tsx";

export const CaptainsDraft = () => {
  const { t } = useTranslation();
  const draft = useReactiveVar(captainsDraftVar);

  if (!draft) return null;

  return (
    <DraftPanel>
      <DraftHeader>
        <DraftTitle>{t("lobby.captainsDraft")}</DraftTitle>
      </DraftHeader>
      {draft.phase === "selecting-captains" && <SelectingCaptains />}
      {draft.phase === "drafting" && <Drafting />}
    </DraftPanel>
  );
};
