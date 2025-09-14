import { addSystem } from "@/shared/context.ts";
import { lobbyContext } from "../contexts.ts";

addSystem({
  props: ["id"],
  onAdd: (e) => {
    if (
      !lobbyContext.current.round?.editor ||
      e.owner ||
      e.actions?.some((a) =>
        a.type === "auto" && a.order === "editorRemoveEntity"
      )
    ) return;
    e.actions = [...e.actions ?? [], {
      type: "auto",
      name: "Remove",
      order: "editorRemoveEntity",
      icon: "collision",
      binding: ["Delete"],
    }];
  },
});
