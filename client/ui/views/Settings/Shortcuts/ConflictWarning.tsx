import i18next from "i18next";
import { AlertTriangle } from "lucide-react";
import type { ConflictInfo } from "@/util/shortcutUtils.ts";
import { getActionDisplayName } from "@/util/shortcutUtils.ts";
import { prefabs } from "@/shared/data.ts";
import { ConflictWarningContainer } from "./styles.ts";

const getSectionDisplayName = (section: string): string =>
  section === "controlGroups"
    ? i18next.t("settings.selectionGroups")
    : section === "misc"
    ? i18next.t("settings.misc")
    : prefabs[section]?.name ?? section;

type ConflictWarningProps = {
  conflict: ConflictInfo;
  section: string;
};

export const ConflictWarning = (
  { conflict, section }: ConflictWarningProps,
) => (
  <ConflictWarningContainer>
    <AlertTriangle size={12} />
    {i18next.t("settings.conflictsWith", {
      names: conflict.conflictsWith.map((c) => {
        const name = getActionDisplayName(c.actionKey, c.section ?? section);
        return c.section
          ? `${name} (${getSectionDisplayName(c.section)})`
          : name;
      }).join(", "),
    })}
  </ConflictWarningContainer>
);
