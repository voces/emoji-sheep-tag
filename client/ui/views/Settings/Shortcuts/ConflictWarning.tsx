import type { ConflictInfo } from "@/util/shortcutUtils.ts";
import { getActionDisplayName } from "@/util/shortcutUtils.ts";
import { ConflictWarningContainer } from "./styles.ts";

type ConflictWarningProps = {
  conflict: ConflictInfo;
  section: string;
};

export const ConflictWarning = (
  { conflict, section }: ConflictWarningProps,
) => (
  <ConflictWarningContainer>
    ⚠ Conflicts with:{" "}
    {conflict.conflictsWith.map((c) =>
      getActionDisplayName(c.actionKey, section)
    ).join(", ")}
  </ConflictWarningContainer>
);
