import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vitest";
import { type CliHandlers, runCli } from "../../src/cli/runCli.js";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string; bin: { ala: string } };
const executable = fileURLToPath(
  new URL(`../../${packageJson.bin.ala}`, import.meta.url),
);

function handlers(): CliHandlers {
  return {
    mcp: vi.fn(async () => ({ exitCode: 0 })),
    doctor: vi.fn(async () => ({ exitCode: 0 })),
    gc: vi.fn(async () => ({ exitCode: 0 })),
  };
}

function invoke(args: string[]) {
  return spawnSync(process.execPath, [executable, ...args], {
    cwd: tmpdir(),
    encoding: "utf8",
  });
}

test.each([
  [[], "stdio"],
  [["--http"], "http"],
] as const)("dispatches MCP options %j to %s", async (options, transport) => {
  const services = handlers();
  const result = await runCli(
    ["mcp", ...options],
    packageJson.version,
    services,
  );
  expect(services.mcp).toHaveBeenCalledExactlyOnceWith({ transport });
  expect(services.doctor).not.toHaveBeenCalled();
  expect(result).toEqual({ exitCode: 0 });
});

test("dispatches doctor and preserves the handler result", async () => {
  const services = handlers();
  services.doctor = vi.fn(async () => ({ exitCode: 1, stderr: "not ready\n" }));
  expect(await runCli(["doctor"], packageJson.version, services)).toEqual({
    exitCode: 1,
    stderr: "not ready\n",
  });
  expect(services.doctor).toHaveBeenCalledExactlyOnceWith();
  expect(services.mcp).not.toHaveBeenCalled();
});

test.each([[], ["--help"], ["-h"], ["mcp", "--help"], ["doctor", "-h"]])(
  "prints help for %j without starting services",
  async (...args: string[]) => {
    const services = handlers();
    const result = await runCli(args, packageJson.version, services);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: ala <command>");
    expect(result.stderr).toBeUndefined();
    expect(services.mcp).not.toHaveBeenCalled();
    expect(services.doctor).not.toHaveBeenCalled();
  },
);

test("installed entry point prints the package version from another directory", () => {
  const result = invoke(["--version"]);
  expect(result.status).toBe(0);
  expect(result.stdout).toBe(`${packageJson.version}\n`);
  expect(result.stderr).toBe("");
});

test("installed entry point prints help", () => {
  const result = invoke(["--help"]);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("mcp --http");
  expect(result.stderr).toBe("");
});

test.each([
  ["wat"],
  ["mcp", "--wat"],
  ["doctor", "--http"],
  ["--version", "extra"],
  ["mcp", "--http", "--http"],
])("rejects invalid arguments %j with help on stderr", (...args: string[]) => {
  const result = invoke(args);
  expect(result.status).toBe(2);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Unknown command or options.");
  expect(result.stderr).toContain("Usage: ala <command>");
});

test.each([["mcp", "--http"], ["doctor"]])(
  "reports unavailable services for %j without contaminating stdout",
  (...args: string[]) => {
    const result = invoke(args);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("not available in this build");
  },
);
