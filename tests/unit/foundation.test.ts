import { expect, test } from "vitest";

// P0-01 smoke test: exercise the runner before application modules exist.
test("runs the foundation test suite", () => {
  expect(true).toBe(true);
});
