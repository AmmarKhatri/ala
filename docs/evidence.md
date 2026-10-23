# Evidence and unknown records

P0-09 implements the PLAN.md §16.1 and §16.3 shapes with Zod in pure domain modules.
Callers supply IDs, timestamps, environment IDs, input artifact digests, and the
previous evidence digest. IDs use `ev_`/`unk_` plus a ULID-formatted suffix. Genesis
may use 64 zeroes for `prev_digest`; later ledger integration supplies the actual
previous evidence digest.

`createEvidenceRecord(input, dataSchema)` validates metadata and requires the
method's own data schema. Schemas may refine but cannot silently transform recorded
data. Both creation and `readEvidenceRecord` return cloned, deeply frozen records.
Deserialization recomputes the digest and rejects tampering. Mutable caller input
cannot change an existing record.

`canonicalJson` recursively sorts object keys, preserves array order, uses JavaScript
JSON number/string encoding, and rejects nonfinite, cyclic, or non-JSON data.
`jsonDigest` hashes its UTF-8 representation with SHA-256. This is ALA's deterministic
JSON format, not a claim of full RFC 8785 conformance. The evidence digest covers all
fields except `digest`. The storage ledger's outer hash remains a separate chain.

## Confidence promotion

Existing confidence cannot be mutated. `promoteEvidence(previous, next, dataSchema)`
creates a distinct record for the same workspace/target/candidate, requires the prior
ID in `parents`, validates the prior digest, and requires a stronger confidence and
new method or result data. Changing only timestamps, duration, or the confidence label
does not count as new evidence.

Static analysis supports inferred/unknown only. Tested confidence requires a verify,
fuzz, sanitizer, or spec-validation method; proven confidence requires a proof method.
Tested/proven claims require successful method exit. Bounded proofs must state
limitations. Measurement belongs to benchmark, counters, profile, or end-to-end
methods and cannot be promoted into correctness proof by relabeling.

This API validates provenance structure and prevents in-place promotion. It cannot
establish that an external tool actually ran or that supplied results are truthful;
trusted provider execution and verification lanes must establish those facts.
Persistence must enforce ID uniqueness and reference existence when integrating these
models into the workspace ledger.

## Unknowns

Unknowns track correctness, performance, portability, integration, or spec questions
with a proposed probe. `readUnknown` validates and freezes them. `resolveUnknown`
returns a new resolved snapshot with an evidence ID, preserving the original open
snapshot. Resolved records require `resolved_by`; open/wont-fix records forbid it.
The persistence layer must verify that resolving evidence exists. Automatic creation
of standard unknowns belongs to the later services that identify those gaps.
