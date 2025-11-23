import { addSystem } from "@/shared/context.ts";
import { practiceModeActions } from "@/shared/data.ts";
import { isPractice } from "../api/st.ts";
import { Entity } from "@/shared/types.ts";

const addPracticeModeAction = (entity: Entity) => {
  if (!isPractice()) return;
  if (!entity.trueOwner || !entity.actions) return;

  // Remove any existing practice mode actions
  entity.actions = entity.actions.filter((a) =>
    !(a.type === "auto" &&
      (a.order === "giveToEnemy" || a.order === "reclaimFromEnemy"))
  );

  // Add the appropriate action based on current ownership
  const actionToAdd = entity.trueOwner !== entity.owner
    ? practiceModeActions.reclaimFromEnemy
    : practiceModeActions.giveToEnemy;

  entity.actions = [...entity.actions, actionToAdd];
};

addSystem({
  props: ["trueOwner", "owner"],
  onAdd: addPracticeModeAction,
  onChange: addPracticeModeAction,
  onRemove: (entity) => {
    if (!isPractice()) return;
    if (!entity.actions) return;

    // Clean up practice mode actions when entity is removed from the system
    entity.actions = entity.actions.filter((a) =>
      !(a.type === "auto" &&
        (a.order === "giveToEnemy" || a.order === "reclaimFromEnemy"))
    );
  },
});
