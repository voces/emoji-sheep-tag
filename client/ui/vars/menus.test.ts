import "@/client-testing/setup.ts";
import { it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { deletedMenusVar, menusVar } from "./menus.ts";

it("tracks deleted default menus as soon as menus change", () => {
  menusVar([{ id: "custom", name: "Custom", prefabs: ["sheep"], actions: [] }]);

  expect(deletedMenusVar()).toEqual({ shop: ["wolf"], editor: ["editor"] });
});
