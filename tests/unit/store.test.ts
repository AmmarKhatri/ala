import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";
import { WorkspaceStore } from "../../src/store/workspaceStore.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function create() {
  const root = await mkdtemp(join(tmpdir(), "ala-store-test-"));
  roots.push(root);
  return WorkspaceStore.create(root);
}

test("CAS round trips, deduplicates, and detects corrupt content", async () => {
  const store = await create();
  const digest = await store.putObject(Buffer.from("artifact"));
  expect(await store.putObject(Buffer.from("artifact"))).toBe(digest);
  expect((await store.readObject(digest)).toString()).toBe("artifact");
  const path = join(
    store.root,
    "objects",
    "sha256",
    digest.slice(0, 2),
    digest,
  );
  await writeFile(path, "tampered");
  await expect(store.readObject(digest)).rejects.toMatchObject({
    code: "integrity_violation",
  });
  await expect(store.putObject(Buffer.from("artifact"))).rejects.toMatchObject({
    code: "integrity_violation",
  });
  await expect(store.readObject("../../outside")).rejects.toMatchObject({
    code: "invalid_request",
  });
});

test("ledger detects record tampering, reordering, and partial writes", async () => {
  const store = await create();
  await store.appendRecord({ event: "first" });
  await store.appendRecord({ event: "second" });
  const path = join(store.root, "ledger.jsonl");
  const original = await readFile(path, "utf8");
  const lines = original.trimEnd().split("\n");
  expect(await store.readLedger()).toHaveLength(2);
  for (const bad of [
    original.replace("first", "other"),
    `${lines.reverse().join("\n")}\n`,
    original.slice(0, -1),
  ]) {
    await writeFile(path, bad);
    await expect(store.readLedger()).rejects.toMatchObject({
      code: "integrity_violation",
    });
    await expect(store.appendRecord({ event: "third" })).rejects.toMatchObject({
      code: "integrity_violation",
    });
  }
});

test("state references, ledger references, and receipt pins survive gc", async () => {
  const store = await create();
  const digests: string[] = [];
  for (const value of ["state", "ledger", "receipt", "unused"])
    digests.push(await store.putObject(Buffer.from(value)));
  await store.writeState({ selected: true }, [digests[0]]);
  await store.appendRecord({ evidence: "test" }, [digests[1]]);
  await store.pinReceipt("receipt_1", [digests[2]]);
  expect(await store.gc(true)).toEqual({
    removed: [digests[3]],
    retained: 3,
    dry_run: true,
  });
  expect((await store.readObject(digests[3])).toString()).toBe("unused");
  expect(await store.gc()).toEqual({
    removed: [digests[3]],
    retained: 3,
    dry_run: false,
  });
  for (const digest of digests.slice(0, 3))
    await expect(store.readObject(digest)).resolves.toBeInstanceOf(Buffer);
  await expect(store.readObject(digests[3])).rejects.toMatchObject({
    code: "not_found",
  });
});

test("gc refuses corruption before deleting any objects", async () => {
  const store = await create();
  const digest = await store.putObject(Buffer.from("unreferenced"));
  await writeFile(join(store.root, "ledger.jsonl"), "bad\n");
  await expect(store.gc()).rejects.toMatchObject({
    code: "integrity_violation",
  });
  await expect(store.readObject(digest)).resolves.toBeInstanceOf(Buffer);
});

test("state updates preserve receipt pins and reject missing references", async () => {
  const store = await create();
  const digest = await store.putObject(Buffer.from("receipt"));
  await store.pinReceipt("receipt_1", [digest]);
  await store.writeState({ revision: 2 });
  expect((await store.readState()).receipt_pins).toEqual({
    receipt_1: [digest],
  });
  await expect(
    store.writeState({ revision: 3 }, ["a".repeat(64)]),
  ).rejects.toMatchObject({ code: "not_found" });
  expect((await store.readState()).data).toEqual({ revision: 2 });
});

test("existing incomplete stores are rejected instead of silently repaired", async () => {
  const store = await create();
  await rm(join(store.root, "ledger.jsonl"));
  await expect(WorkspaceStore.create(store.root)).rejects.toMatchObject({
    code: "integrity_violation",
  });
  expect(existsSync(join(store.root, "ledger.jsonl"))).toBe(false);
});

test("single-writer lock fails closed with recovery instructions", async () => {
  const store = await create();
  await writeFile(join(store.root, ".writer.lock"), '{"pid":1}');
  await expect(store.writeState({})).rejects.toMatchObject({
    code: "invalid_request",
    remediation: {
      action: expect.stringContaining("verify no writer is running"),
    },
  });
});

test("killing a writer before rename leaves the previous complete state", async () => {
  const store = await create();
  await store.writeState({ revision: 1 });
  const moduleUrl = new URL(
    "../../dist/store/workspaceStore.js",
    import.meta.url,
  ).href;
  // Intercept only the rename boundary; the child performs real file writes and fsync.
  const script = `
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
fs.promises.rename = async () => { process.stdout.write('ready'); await new Promise(() => setInterval(() => {}, 1000)); };
syncBuiltinESMExports();
const { WorkspaceStore } = await import(${JSON.stringify(moduleUrl)});
const store = await WorkspaceStore.openExisting(${JSON.stringify(store.root)});
await store.writeState({ revision: 2 });
`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", script], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const closed = once(child, "close");
  let ready = "";
  child.stdout.on("data", (chunk: Buffer) => {
    ready += chunk.toString();
  });
  try {
    await expect.poll(() => ready, { timeout: 2000 }).toBe("ready");
  } finally {
    child.kill("SIGKILL");
    await closed;
  }
  expect((await store.readState()).data).toEqual({ revision: 1 });
  expect(
    (await readdir(store.root)).some((name) => name.startsWith(".ala-write-")),
  ).toBe(true);
  expect(existsSync(join(store.root, ".writer.lock"))).toBe(true);
});

test("built gc CLI supports dry run and real deletion", async () => {
  const store = await create();
  const digest = await store.putObject(Buffer.from("garbage"));
  const bin = fileURLToPath(new URL("../../bin/ala.mjs", import.meta.url));
  for (const args of [
    ["gc", store.root, "--dry-run"],
    ["gc", store.root],
  ]) {
    const result = spawnSync(process.execPath, [bin, ...args], {
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).removed).toEqual([digest]);
    expect(result.stderr).toBe("");
  }
  await expect(store.readObject(digest)).rejects.toMatchObject({
    code: "not_found",
  });
});

test("CAS snapshots mutable input before asynchronous writes", async () => {
  const store = await create();
  const bytes = Buffer.from("original");
  const pending = store.putObject(bytes);
  bytes.fill(0);
  const digest = await pending;
  expect((await store.readObject(digest)).toString()).toBe("original");
  expect((await WorkspaceStore.create(store.root)).root).toBe(store.root);
});
