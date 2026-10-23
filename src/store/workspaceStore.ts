import { createHash } from "node:crypto";
import { mkdir, open, readFile, readdir, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import {
  AlaError,
  IntegrityViolationError,
  InternalError,
  InvalidRequestError,
  NotFoundError,
} from "../domain/errors/alaError.js";
import { atomicWrite } from "./atomicWrite.js";

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const stateSchema = z.strictObject({
  version: z.literal(1),
  data: z.json(),
  object_digests: z.array(digestSchema),
  receipt_pins: z.record(z.string(), z.array(digestSchema)),
});
const recordSchema = z.strictObject({
  sequence: z.number().int().positive(),
  previous: digestSchema.nullable(),
  payload: z.json(),
  object_digests: z.array(digestSchema),
  hash: digestSchema,
});
export type StoreState = z.infer<typeof stateSchema>;
export type LedgerRecord = z.infer<typeof recordSchema>;
const hash = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const missing = (error: unknown) =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

function jsonValue(value: unknown) {
  try {
    JSON.stringify(value); // Detect cycles before recursive schema validation.
    return z.json().parse(value);
  } catch {
    throw new InvalidRequestError({
      message: "Store payloads must be JSON values.",
    });
  }
}

export class WorkspaceStore {
  private constructor(readonly root: string) {}

  static async create(root: string) {
    const store = new WorkspaceStore(resolve(root));
    await mkdir(join(store.root, "objects", "sha256"), {
      recursive: true,
      mode: 0o700,
    });
    await store.exclusive(async () => {
      const present = await Promise.all(
        ["state.json", "ledger.jsonl"].map(async (name) => {
          try {
            await stat(join(store.root, name));
            return true;
          } catch (error) {
            if (missing(error)) return false;
            throw error;
          }
        }),
      );
      if (present[0] !== present[1])
        throw new IntegrityViolationError({
          message:
            "Store initialization is incomplete or a required file was removed.",
        });
      if (!present[0]) {
        await atomicWrite(
          join(store.root, "state.json"),
          JSON.stringify({
            version: 1,
            data: {},
            object_digests: [],
            receipt_pins: {},
          }),
        );
        await atomicWrite(join(store.root, "ledger.jsonl"), "");
      }
      await store.readLedgerUnlocked();
      await store.readState();
    });
    return store;
  }

  static async openExisting(root: string) {
    const store = new WorkspaceStore(resolve(root));
    try {
      await stat(join(store.root, "state.json"));
    } catch (error) {
      if (missing(error))
        throw new NotFoundError({ message: "Workspace store not found." });
      throw error;
    }
    await store.readState();
    return store;
  }

  private objectPath(digest: string) {
    if (!digestSchema.safeParse(digest).success)
      throw new InvalidRequestError({
        message: "Expected a SHA-256 object digest.",
      });
    return join(this.root, "objects", "sha256", digest.slice(0, 2), digest);
  }

  private async exclusive<T>(action: () => Promise<T>): Promise<T> {
    const lockPath = join(this.root, ".writer.lock");
    const lock = await open(lockPath, "wx", 0o600).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "EEXIST")
          throw new InvalidRequestError({
            message: "The workspace store is locked.",
            remediation: {
              action:
                "Wait for the writer to finish. After a crash, verify no writer is running before removing .writer.lock.",
            },
          });
        throw new InternalError({
          message: "The store lock could not be acquired.",
        });
      },
    );
    try {
      await lock.writeFile(JSON.stringify({ pid: process.pid }));
      return await action();
    } catch (error) {
      if (error instanceof AlaError) throw error;
      throw new InternalError({ message: "The store operation failed." });
    } finally {
      await lock.close();
      await rm(lockPath, { force: true });
    }
  }

  async putObject(bytes: Buffer): Promise<string> {
    const content = Buffer.from(bytes);
    const digest = hash(content);
    const path = this.objectPath(digest);
    return this.exclusive(async () => {
      await mkdir(join(this.root, "objects", "sha256", digest.slice(0, 2)), {
        recursive: true,
        mode: 0o700,
      });
      try {
        const existing = await readFile(path);
        if (hash(existing) !== digest)
          throw new IntegrityViolationError({
            message: "Stored object digest mismatch.",
          });
      } catch (error) {
        if (!missing(error)) throw error;
        await atomicWrite(path, content);
      }
      return digest;
    });
  }

  async readObject(digest: string): Promise<Buffer> {
    const bytes = await readFile(this.objectPath(digest)).catch((error) => {
      if (missing(error))
        throw new NotFoundError({
          message: "Stored object not found.",
          details: { digest },
        });
      throw error;
    });
    if (hash(bytes) !== digest)
      throw new IntegrityViolationError({
        message: "Stored object digest mismatch.",
        details: { digest },
      });
    return bytes;
  }

  async readState(): Promise<StoreState> {
    try {
      return stateSchema.parse(
        JSON.parse(await readFile(join(this.root, "state.json"), "utf8")),
      );
    } catch {
      throw new IntegrityViolationError({
        message: "Workspace state is missing or invalid.",
      });
    }
  }

  private async validateReferences(digests: readonly string[]) {
    for (const digest of digests) await this.readObject(digest);
  }

  async writeState(data: unknown, digests: string[] = []) {
    const payload = jsonValue(data);
    digests = [...digests];
    return this.exclusive(async () => {
      await this.validateReferences(digests);
      const previous = await this.readState();
      await atomicWrite(
        join(this.root, "state.json"),
        JSON.stringify({ ...previous, data: payload, object_digests: digests }),
      );
    });
  }

  async pinReceipt(receiptId: string, digests: string[]) {
    if (!receiptId) throw new InvalidRequestError();
    digests = [...digests];
    return this.exclusive(async () => {
      await this.validateReferences(digests);
      const previous = await this.readState();
      await atomicWrite(
        join(this.root, "state.json"),
        JSON.stringify({
          ...previous,
          receipt_pins: { ...previous.receipt_pins, [receiptId]: digests },
        }),
      );
    });
  }

  private async readLedgerUnlocked(): Promise<LedgerRecord[]> {
    try {
      const text = await readFile(join(this.root, "ledger.jsonl"), "utf8");
      if (text && !text.endsWith("\n"))
        throw new IntegrityViolationError({
          message: "Ledger has an incomplete final record.",
        });
      const records: LedgerRecord[] = [];
      for (const line of text === "" ? [] : text.slice(0, -1).split("\n")) {
        const record = recordSchema.parse(JSON.parse(line));
        const { hash: digest, ...body } = record;
        if (
          record.sequence !== records.length + 1 ||
          record.previous !== (records.at(-1)?.hash ?? null) ||
          hash(JSON.stringify(body)) !== digest
        )
          throw new IntegrityViolationError({
            message: "Ledger hash chain verification failed.",
          });
        records.push(record);
      }
      return records;
    } catch (error) {
      if (error instanceof IntegrityViolationError) throw error;
      throw new IntegrityViolationError({
        message: "Ledger is missing or malformed.",
      });
    }
  }

  async readLedger() {
    return this.exclusive(() => this.readLedgerUnlocked());
  }

  async appendRecord(
    payload: unknown,
    digests: string[] = [],
  ): Promise<LedgerRecord> {
    const data = jsonValue(payload);
    digests = [...digests];
    return this.exclusive(async () => {
      const records = await this.readLedgerUnlocked();
      await this.validateReferences(digests);
      const body = {
        sequence: records.length + 1,
        previous: records.at(-1)?.hash ?? null,
        payload: data,
        object_digests: digests,
      };
      const record = { ...body, hash: hash(JSON.stringify(body)) };
      const file = await open(join(this.root, "ledger.jsonl"), "a", 0o600);
      try {
        await file.writeFile(`${JSON.stringify(record)}\n`);
        await file.sync();
      } finally {
        await file.close();
      }
      return record;
    });
  }

  async gc(
    dryRun = false,
  ): Promise<{ removed: string[]; retained: number; dry_run: boolean }> {
    return this.exclusive(async () => {
      const records = await this.readLedgerUnlocked();
      const state = await this.readState();
      const live = new Set([
        ...state.object_digests,
        ...Object.values(state.receipt_pins).flat(),
        ...records.flatMap((record) => record.object_digests),
      ]);
      await this.validateReferences([...live]);
      const unreferenced: string[] = [];
      const objectsRoot = join(this.root, "objects", "sha256");
      for (const shard of await readdir(objectsRoot, { withFileTypes: true })) {
        if (!shard.isDirectory() || !/^[a-f0-9]{2}$/.test(shard.name)) continue;
        for (const entry of await readdir(join(objectsRoot, shard.name), {
          withFileTypes: true,
        })) {
          if (
            !entry.isFile() ||
            !digestSchema.safeParse(entry.name).success ||
            !entry.name.startsWith(shard.name)
          )
            continue;
          await this.readObject(entry.name);
          if (!live.has(entry.name)) unreferenced.push(entry.name);
        }
      }
      unreferenced.sort();
      if (!dryRun)
        for (const digest of unreferenced) await rm(this.objectPath(digest));
      return { removed: unreferenced, retained: live.size, dry_run: dryRun };
    });
  }
}
