import "npm:global-jsdom/register";
import { afterEach, beforeEach } from "jsr:@std/testing/bdd";
import { cleanup } from "npm:@testing-library/react";
import { __testing_reset_all_vars } from "../hooks/useVar.tsx";

beforeEach(__testing_reset_all_vars);

afterEach(() => {
  cleanup();
});
