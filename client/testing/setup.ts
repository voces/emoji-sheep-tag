import "npm:global-jsdom/register";
import { afterEach, beforeEach } from "jsr:@std/testing/bdd";
import { cleanup } from "npm:@testing-library/react";
import { __testing_reset_all_vars } from "@/hooks/useVar.tsx";
import { data } from "../data.ts";
import { app, map, unloadEcs } from "../ecs.ts";

// Basic setup for tests that only need client state cleanup (no WebSocket server)
beforeEach(() => {
  // Reset client state (shared by all tests)
  __testing_reset_all_vars();
  data.sheep = [];
  data.wolves = [];
  unloadEcs();
});

afterEach(() => {
  for (const entity of app.entities) app.removeEntity(entity);
  for (const key in map) delete map[key];
  cleanup();
});
