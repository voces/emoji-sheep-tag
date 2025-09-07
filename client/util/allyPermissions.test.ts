import { expect } from "jsr:@std/expect";
import { describe, it } from "jsr:@std/testing/bdd";
import { getExecutableActions, hasAllyActions } from "./allyPermissions.ts";
import { Entity, UnitDataAction } from "@/shared/types.ts";

describe("client allyPermissions", () => {
  const entityWithAllyActions: Entity = {
    id: "entity1",
    owner: "player1",
    actions: [
      {
        name: "Move",
        type: "auto",
        order: "move",
      },
      {
        name: "Self destruct",
        type: "auto",
        order: "selfDestruct",
        allowAllies: true,
      },
    ],
  };

  const entityWithoutAllyActions: Entity = {
    id: "entity4",
    owner: "player4",
    actions: [
      {
        name: "Move",
        type: "auto",
        order: "move",
      },
      {
        name: "Attack",
        type: "auto",
        order: "attack",
      },
    ],
  };

  describe("hasAllyActions", () => {
    it("should return true for entities with ally actions", () => {
      expect(hasAllyActions(entityWithAllyActions)).toBe(true);
    });

    it("should return false for entities without ally actions", () => {
      expect(hasAllyActions(entityWithoutAllyActions)).toBe(false);
    });

    it("should return false for entities without actions", () => {
      const entityNoActions: Entity = {
        id: "entity5",
        owner: "player5",
      };

      expect(hasAllyActions(entityNoActions)).toBe(false);
    });

    it("should handle empty actions array", () => {
      const entityEmptyActions: Entity = {
        id: "entity6",
        owner: "player6",
        actions: [],
      };

      expect(hasAllyActions(entityEmptyActions)).toBe(false);
    });
  });

  describe("getExecutableActions - ownership filtering", () => {
    it("should return all actions for owned entities", () => {
      const actions = getExecutableActions(
        "player1",
        entityWithAllyActions,
        entityWithAllyActions.actions!,
      );

      expect(actions).toHaveLength(2);
      expect(actions[0].name).toBe("Move");
      expect(actions[1].name).toBe("Self destruct");
    });

    it("should handle empty actions array", () => {
      const actions = getExecutableActions(
        "player1",
        entityWithAllyActions,
        [],
      );

      expect(actions).toHaveLength(0);
    });

    it("should handle different action types", () => {
      const mixedActions: UnitDataAction[] = [
        {
          name: "Build Hut",
          type: "build",
          unitType: "hut",
          allowAllies: true,
        },
        {
          name: "Attack",
          type: "target",
          order: "attack",
          allowAllies: false,
        },
        {
          name: "Buy Item",
          type: "purchase",
          itemId: "claw",
          goldCost: 100,
          allowAllies: true,
        },
        {
          name: "Shop",
          type: "menu",
          actions: [],
          allowAllies: false,
        },
      ];

      // For owned entity, should get all actions
      const ownActions = getExecutableActions(
        "player1",
        entityWithAllyActions,
        mixedActions,
      );
      expect(ownActions).toHaveLength(4);
    });
  });
});
