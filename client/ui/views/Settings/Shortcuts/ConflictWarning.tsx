import type { ConflictInfo } from "@/util/shortcutUtils.ts";
import { getActionDisplayName } from "@/util/shortcutUtils.ts";
import { prefabs } from "@/shared/data.ts";
import { ConflictWarningContainer } from "./styles.ts";

const getSectionDisplayName = (section: string): string =>
  section === "controlGroups"
    ? "Selection Groups"
    : section === "misc"
    ? "Misc"
    : prefabs[section]?.name ?? section;

type ConflictWarningProps = {
  conflict: ConflictInfo;
  section: string;
};

export const ConflictWarning = (
  { conflict, section }: ConflictWarningProps,
) => (
  <ConflictWarningContainer>
    ⚠ Conflicts with: {conflict.conflictsWith.map((c) => {
      const name = getActionDisplayName(c.actionKey, c.section ?? section);
      return c.section ? `${name} (${getSectionDisplayName(c.section)})` : name;
    }).join(", ")}
  </ConflictWarningContainer>
);
