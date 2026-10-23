# Workspace storage

P0-08 implements `WorkspaceStore` over a caller-selected workspace directory.
The later workspace task will choose `.ala/workspaces/<workspace_id>`; this task
does not modify a project's `.gitignore` or create a workspace automatically.
- Objects live under `objects/sha256/<first-two-hex>/<full-sha256>`.
- `ledger.jsonl` contains sequenced, hash-chained records.
- `state.json` contains version 1, JSON `data`, explicit `object_digests`, and
  `receipt_pins` mapping receipt IDs to object digests.

`create` initializes a new store or validates an existing one. An existing store
with either state or ledger missing is rejected rather than silently repaired.
`openExisting` never creates a store. Object writes snapshot mutable bytes and
are content-addressed; reads verify hashes. Invalid digests cannot select paths
outside the object layout. Object content and ledger records are not overwritten.

`appendRecord` validates referenced objects, verifies the existing chain, appends
one record, and fsyncs it. Reads detect malformed or partial records, altered payloads,
and reordered records. The chain has no external trusted anchor yet: an attacker
able to rewrite the entire chain or remove a complete tail can evade a hash chain
alone. Receipts and external evidence anchoring will need to address that separately.

State and CAS files use same-directory temporary files, fsync, atomic rename, and
a directory fsync. A crash before rename leaves the old complete state; after rename
readers see the new complete state. Interrupted writes can leave `.ala-write-*`
files. They are ignored, not interpreted as committed state. The crash test kills
a real child after writing/fsyncing and before rename; it does not simulate power loss.

All mutation, ledger inspection, and GC acquire `.writer.lock` exclusively. There
are no hidden retries. A crash can leave a stale lock. Verify that no writer is
running before removing it; automatic PID-based stale-lock removal is deliberately
not implemented. Atomic state reads and immutable-object reads do not take this lock.

## Garbage collection

```sh
node bin/ala.mjs gc /path/to/workspace --dry-run
node bin/ala.mjs gc /path/to/workspace
```

Both commands validate state, ledger, and object hashes before deleting anything.
Output is JSON with `removed` (candidate digests for dry runs), `retained`, and
`dry_run`. Failures produce a typed error on stderr and exit status 1. Invalid
arguments exit with status 2.

The live set includes state `object_digests`, every ledger record's `object_digests`,
and all receipt pins. `writeState` preserves receipt pins. Callers must explicitly
register object references; arbitrary strings inside JSON data are not treated as
references. GC ignores unknown filenames and temporary files. Corruption stops GC
before any deletion. Deletion is not transactional: an I/O failure midway may leave
some unreferenced objects for a later run. No referenced object is selected for deletion.

This is local storage on the current filesystem. Multi-host filesystems, hostile
symlink manipulation, workspace management, and receipt generation are not established
by these tests.
