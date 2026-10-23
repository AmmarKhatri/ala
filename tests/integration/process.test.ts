import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, expect, test } from "vitest";
import { runProcess } from "../../src/process/runProcess.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

async function fixtureRoot() {
  const root = await mkdtemp(join(tmpdir(), "ala-process-test-"));
  roots.push(root);
  return root;
}

const treeCode = `
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const script = "const fs = require('node:fs'); setInterval(() => fs.writeFileSync(process.argv[1], String(Date.now())), 10);";
const grandchild = spawn(process.execPath, ['-e', script, process.argv[1]], { stdio: 'ignore' });
fs.writeFileSync(process.argv[2], JSON.stringify({ pid: grandchild.pid, root: process.env.HOME }));
setInterval(() => {}, 1000);
`;

test("captures a real process and removes its private directory", async () => {
  const result = await runProcess({
    command: process.execPath,
    args: [
      "-e",
      "console.log(JSON.stringify({ root: process.cwd(), mode: require('node:fs').statSync(process.cwd()).mode & 511 })); console.error('stderr');",
    ],
  });
  const info = JSON.parse(result.stdout.toString()) as {
    root: string;
    mode: number;
  };
  expect(info.mode).toBe(0o700);
  expect(existsSync(info.root)).toBe(false);
  expect(result.exitCode).toBe(0);
  expect(result.stderr.toString()).toBe("stderr\n");
  expect(result.output_truncated).toEqual({ stdout: false, stderr: false });
});

test("caps raw bytes independently while draining both pipes", async () => {
  const result = await runProcess({
    command: process.execPath,
    args: [
      "-e",
      "process.stdout.write(Buffer.alloc(200000, 65)); process.stderr.write(Buffer.alloc(200000, 66));",
    ],
    environment: {
      ALA_PROCESS_STDOUT_MAX_BYTES: "17",
      ALA_PROCESS_STDERR_MAX_BYTES: "23",
    },
  });
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toEqual(Buffer.alloc(17, 65));
  expect(result.stderr).toEqual(Buffer.alloc(23, 66));
  expect(result.output_truncated).toEqual({ stdout: true, stderr: true });
});

test("scrubs secrets and runtime injection variables and redirects HOME/temp", async () => {
  const result = await runProcess({
    command: process.execPath,
    args: ["-e", "console.log(JSON.stringify(process.env))"],
    environment: {
      PATH: "/usr/bin",
      LANG: "C",
      API_TOKEN: "secret",
      NODE_OPTIONS: "--this-would-fail",
      LD_PRELOAD: "bad",
      DYLD_INSERT_LIBRARIES: "bad",
      HOME: "/secret/home",
      TMPDIR: "/secret/tmp",
    },
  });
  const env = JSON.parse(result.stdout.toString());
  expect(env.PATH).toBe("/usr/bin");
  expect(env.LANG).toBe("C");
  expect(env.API_TOKEN).toBeUndefined();
  expect(env.NODE_OPTIONS).toBeUndefined();
  expect(env.LD_PRELOAD).toBeUndefined();
  expect(env.DYLD_INSERT_LIBRARIES).toBeUndefined();
  expect(env.HOME).toBe(env.TMPDIR);
  expect(env.HOME).not.toBe("/secret/home");
  expect(existsSync(env.HOME)).toBe(false);
});

test("deadline kills grandchildren and cleans the private directory", async () => {
  const root = await fixtureRoot();
  const heartbeat = join(root, "heartbeat");
  const infoPath = join(root, "info");
  await expect(
    runProcess({
      command: process.execPath,
      args: ["-e", treeCode, heartbeat, infoPath],
      environment: { ALA_COMMAND_TIMEOUT_MS: "500" },
    }),
  ).rejects.toMatchObject({
    code: "deadline_exceeded",
    details: { effective_timeout_ms: 500 },
  });
  const info = JSON.parse(await readFile(infoPath, "utf8")) as { root: string };
  const before = await readFile(heartbeat, "utf8");
  await delay(80);
  expect(await readFile(heartbeat, "utf8")).toBe(before);
  expect(existsSync(info.root)).toBe(false);
});

test("cancellation kills the owned tree and cleans its directory", async () => {
  const root = await fixtureRoot();
  const heartbeat = join(root, "heartbeat");
  const infoPath = join(root, "info");
  const controller = new AbortController();
  const running = runProcess({
    command: process.execPath,
    args: ["-e", treeCode, heartbeat, infoPath],
    signal: controller.signal,
  });
  const rejection = expect(running).rejects.toMatchObject({
    code: "cancelled",
  });
  try {
    await expect
      .poll(() => existsSync(heartbeat), { timeout: 2000 })
      .toBe(true);
  } finally {
    controller.abort();
  }
  await rejection;
  const info = JSON.parse(await readFile(infoPath, "utf8")) as { root: string };
  const before = await readFile(heartbeat, "utf8");
  await delay(80);
  expect(await readFile(heartbeat, "utf8")).toBe(before);
  expect(existsSync(info.root)).toBe(false);
});

test("preserves nonzero exits and does not interpret shell syntax", async () => {
  const result = await runProcess({
    command: process.execPath,
    args: [
      "-e",
      "console.log(process.argv[1]); process.exitCode = 7;",
      "$(echo injected); & |",
    ],
  });
  expect(result.exitCode).toBe(7);
  expect(result.stdout.toString()).toBe("$(echo injected); & |\n");
});

test("missing executable and pre-cancelled requests are typed errors", async () => {
  await expect(
    runProcess({ command: "/nonexistent/ala-fixture-command" }),
  ).rejects.toMatchObject({ code: "toolchain_missing" });
  await expect(
    runProcess({ command: process.execPath, signal: AbortSignal.abort() }),
  ).rejects.toMatchObject({ code: "cancelled" });
});

test("exact caps do not mark output truncated and report effective limits", async () => {
  const result = await runProcess({
    command: process.execPath,
    args: ["-e", "process.stdout.write('abc'); process.stderr.write('xy');"],
    environment: {
      ALA_PROCESS_STDOUT_MAX_BYTES: "3",
      ALA_PROCESS_STDERR_MAX_BYTES: "2",
    },
  });
  expect(result.output_truncated).toEqual({ stdout: false, stderr: false });
  expect(result.limits.stdout).toContain(
    "ALA_PROCESS_STDOUT_MAX_BYTES value is 3 bytes (source: setting",
  );
  expect(result.limits.stderr).toContain(
    "This does not raise the stdout cap or MCP response budget.",
  );
});

test("a normally exiting parent cannot leave a grandchild holding pipes open", async () => {
  const result = await runProcess({
    command: process.execPath,
    args: [
      "-e",
      "require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit' }).unref(); process.exit(0);",
    ],
    environment: { ALA_COMMAND_TIMEOUT_MS: "2000" },
  });
  expect(result.exitCode).toBe(0);
});
