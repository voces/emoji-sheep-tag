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
    }, {
      type: "auto",
      name: "Move down",
      icon: "down",
      order: "editorMoveEntityDown",
      binding: ["Numpad2"],
    }, {
      type: "auto",
      name: "Move up",
      icon: "up",
      order: "editorMoveEntityUp",
      binding: ["Numpad8"],
    }, {
      type: "auto",
      name: "Move left",
      icon: "left",
      order: "editorMoveEntityLeft",
      binding: ["Numpad4"],
    }, {
      type: "auto",
      name: "Move right",
      icon: "right",
      order: "editorMoveEntityRight",
      binding: ["Numpad6"],
    }];
  },
});
