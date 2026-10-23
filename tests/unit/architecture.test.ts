import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";

const runner = fileURLToPath(
  new URL("../../scripts/checkArchitecture.mjs", import.meta.url),
);
const roots: string[] = [];

function check(files: Record<string, string>) {
  const cwd = mkdtempSync(join(tmpdir(), "ala-architecture-"));
  roots.push(cwd);
  for (const [name, content] of Object.entries(files)) {
    const path = join(cwd, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  const result = spawnSync(process.execPath, [runner], {
    cwd,
    encoding: "utf8",
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

test("accepts an empty foundation", () => {
  expect(check({})).toEqual({
    status: 0,
    output: "Architecture: no source files yet.\n",
  });
});

test("accepts permitted imports, internal helpers, type-only ports, and composition", () => {
  const result = check({
    "src/domain/model.ts": "export interface Model { value: number }",
    "src/domain/helper.ts": 'export type { Model } from "./model.js";',
    "src/providers/ports/compiler.ts":
      'export type { Model as Compiler } from "../../domain/model.js";',
    "src/process/run.ts": "export const run = 1;",
    "src/sandbox/execute.ts": "export const execute = 1;",
    "src/providers/compiler.ts":
      'import "../process/run.js"; import "../sandbox/execute.js"; import type { Model } from "../domain/model.js";',
    "src/store/state.ts": "export const state = 1;",
    "src/application/service.ts":
      'import type { Compiler } from "../providers/ports/compiler.js"; import "../store/state.js"; import type { Model } from "../domain/model.js";',
    "src/contracts/input.ts": "export interface Input { value: number }",
    "src/server/helper.ts": 'import "../application/service.js";',
    "src/server/main.ts":
      'import "./helper.js"; import type { Input } from "../contracts/input.js";',
    "src/cli/main.ts":
      'import "../application/service.js"; import type { Input } from "../contracts/input.js";',
    "src/composition/main.ts":
      'import "../providers/compiler.js"; import "../application/service.js";',
  });
  expect(result.output).toContain("no dependency violations found");
  expect(result.status).toBe(0);
});

test.each([
  ["domain", "application", "domain-boundary"],
  ["application", "providers", "application-boundary"],
  ["application", "server", "application-boundary"],
  ["server", "providers", "server-boundary"],
  ["cli", "domain", "cli-boundary"],
  ["providers", "store", "providers-boundary"],
  ["providers/ports", "providers", "ports-boundary"],
])("rejects %s importing %s", (from, to, rule) => {
  const relative = "../".repeat(from.split("/").length);
  const result = check({
    [`src/${from}/source.ts`]: `import type { Value } from "${relative}${to}/target.js";`,
    [`src/${to}/target.ts`]: "export interface Value { value: number }",
  });
  expect(result.status).toBe(1);
  expect(result.output).toContain(rule);
});

test("rejects runtime imports from ports", () => {
  const result = check({
    "src/application/service.ts":
      'import { value } from "../providers/ports/compiler.js"; console.log(value);',
    "src/providers/ports/compiler.ts": "export const value = 1;",
  });
  expect(result.status).toBe(1);
  expect(result.output).toContain("application-ports-type-only");
});

test.each(["node:fs/promises", "child_process"])(
  "rejects domain I/O through %s",
  (module) => {
    const result = check({ "src/domain/io.ts": `import "${module}";` });
    expect(result.status).toBe(1);
    expect(result.output).toContain("domain-no-node-io");
  },
);

test("rejects unresolved imports instead of silently skipping the boundary", () => {
  const result = check({ "src/domain/model.ts": 'import "../missing.js";' });
  expect(result.status).toBe(1);
  expect(result.output).toContain("no-unresolved-imports");
});
