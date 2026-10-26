import "@/client-testing/setup.ts";
import { expect, it } from "vitest";
import { deletedMenusVar, menusVar } from "./menus.ts";

it("tracks deleted default menus as soon as menus change", () => {
  menusVar([{ id: "custom", name: "Custom", prefabs: ["sheep"], actions: [] }]);

  expect(deletedMenusVar()).toEqual({ shop: ["wolf"], editor: ["editor"] });
});
