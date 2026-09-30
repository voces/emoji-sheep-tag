import { expect } from "@std/expect";
import { Order } from "@/shared/types.ts";
import { zUpdate } from "./schemas.ts";

Deno.test("orders keep lastRepath through parsing", () => {
  const orders: Order[] = [
    { type: "walk", target: { x: 1, y: 2 }, lastRepath: 3 },
    { type: "walk", targetId: "u1", lastRepath: 3 },
    { type: "build", unitType: "hut", x: 1, y: 2, lastRepath: 3 },
    { type: "attack", targetId: "u1", lastRepath: 3 },
    { type: "cast", orderId: "o", remaining: 1, lastRepath: 3 },
    { type: "attackMove", target: { x: 1, y: 2 }, lastRepath: 3 },
  ];
  for (const order of orders) {
    expect(zUpdate.parse({ id: "e", order }).order).toEqual(order);
  }
  expect(zUpdate.parse({ id: "e", queue: orders }).queue).toEqual(orders);
});
