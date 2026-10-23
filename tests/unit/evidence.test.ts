import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { z } from "zod";
import {
  canonicalJson,
  jsonDigest,
} from "../../src/domain/evidence/canonicalJson.js";
import {
  createEvidenceRecord,
  promoteEvidence,
  readEvidenceRecord,
} from "../../src/domain/evidence/record.js";
import {
  readUnknown,
  resolveUnknown,
} from "../../src/domain/evidence/unknown.js";

const oldId = `ev_01${"A".repeat(24)}`;
const newId = `ev_01${"B".repeat(24)}`;
const schema = z.strictObject({ observation: z.string() });
function body() {
  return {
    id: oldId,
    kind: "static_analysis",
    subject: {
      workspace_id: "ws_test",
      target_id: "tgt_test",
      artifact_digests: ["a".repeat(64)],
    },
    tool: {
      name: "llvm-mca",
      version: "test",
      argv: ["input.s"],
      exit_code: 0,
      duration_ms: 10,
    },
    environment_id: "env_test",
    confidence: "inferred",
    summary: "Static estimate only.",
    data: { observation: "estimate" },
    limitations: ["Not measured."],
    parents: [],
    created_at: "2026-10-24T00:00:00Z",
    prev_digest: "0".repeat(64),
  };
}

test("canonical JSON has deterministic recursive key ordering and standard SHA-256", () => {
  const one = { z: [{ b: 2, a: 1 }], a: "x" };
  const two = { a: "x", z: [{ a: 1, b: 2 }] };
  const expected = '{"a":"x","z":[{"a":1,"b":2}]}';
  expect(canonicalJson(one)).toBe(expected);
  expect(canonicalJson(two)).toBe(expected);
  expect(jsonDigest(one)).toBe(
    createHash("sha256").update(expected).digest("hex"),
  );
  expect(canonicalJson({ "2": true, "10": false })).toBe(
    '{"10":false,"2":true}',
  );
});

test.each([undefined, Number.NaN, Infinity, 1n, () => 1, { a: undefined }])(
  "canonical JSON rejects non-JSON values",
  (value) => {
    expect(() => canonicalJson(value)).toThrowError(
      expect.objectContaining({ code: "invalid_request" }),
    );
  },
);

test("canonical JSON rejects cycles", () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  expect(() => canonicalJson(cyclic)).toThrowError(
    expect.objectContaining({ code: "invalid_request" }),
  );
});

test("evidence round trips, has a stable digest, and is deeply immutable", () => {
  const input = body();
  const record = createEvidenceRecord(input, schema);
  expect(
    readEvidenceRecord(JSON.parse(JSON.stringify(record)), schema),
  ).toEqual(record);
  expect(
    createEvidenceRecord(
      { ...input, data: { observation: "estimate" } },
      schema,
    ).digest,
  ).toBe(record.digest);
  expect(() => Object.assign(record, { confidence: "proven" })).toThrow();
  expect(() => record.parents.push(newId)).toThrow();
  input.subject.artifact_digests.push("b".repeat(64));
  expect(record.subject.artifact_digests).toHaveLength(1);
});

test("evidence tampering and invalid method data are rejected", () => {
  const record = createEvidenceRecord(body(), schema);
  expect(() =>
    readEvidenceRecord({ ...record, summary: "tampered" }, schema),
  ).toThrowError(expect.objectContaining({ code: "integrity_violation" }));
  expect(() =>
    createEvidenceRecord({ ...body(), data: {} }, schema),
  ).toThrowError(expect.objectContaining({ code: "invalid_request" }));
  expect(() =>
    createEvidenceRecord({ ...body(), confidence: "tested" }, schema),
  ).toThrowError(expect.objectContaining({ code: "invalid_request" }));
  expect(() =>
    createEvidenceRecord(
      {
        ...body(),
        kind: "verify",
        confidence: "tested",
        tool: { ...body().tool, exit_code: 1 },
      },
      schema,
    ),
  ).toThrowError(expect.objectContaining({ code: "invalid_request" }));
});

test("promotion creates a distinct higher-confidence record citing the original", () => {
  const old = createEvidenceRecord(body(), schema);
  const input = {
    ...body(),
    id: newId,
    kind: "verify",
    confidence: "tested",
    tool: { ...body().tool, name: "differential-harness" },
    data: { observation: "tests passed" },
    parents: [old.id],
  };
  const next = promoteEvidence(old, input, schema);
  expect(next.confidence).toBe("tested");
  expect(next.parents).toContain(old.id);
  expect(old.confidence).toBe("inferred");
  expect(next.digest).not.toBe(old.digest);
  for (const invalid of [
    { ...input, id: old.id },
    { ...input, parents: [] },
    { ...input, confidence: "inferred" },
    { ...input, kind: "static_analysis" },
    { ...input, subject: { ...input.subject, target_id: "other" } },
  ]) {
    expect(() => promoteEvidence(old, invalid, schema)).toThrowError(
      expect.objectContaining({ code: "invalid_request" }),
    );
  }
});

test("same data and method cannot be promoted just by relabeling or changing duration", () => {
  const input = {
    ...body(),
    kind: "verify",
    confidence: "tested_low_coverage",
  };
  const old = createEvidenceRecord(input, schema);
  expect(() =>
    promoteEvidence(
      old,
      {
        ...input,
        id: newId,
        confidence: "tested",
        parents: [old.id],
        tool: { ...input.tool, duration_ms: 999 },
      },
      schema,
    ),
  ).toThrowError(expect.objectContaining({ code: "invalid_request" }));
});

test("bounded proofs must state limitations and measurement does not imply correctness", () => {
  expect(() =>
    createEvidenceRecord(
      {
        ...body(),
        kind: "proof",
        confidence: "proven_bounded",
        limitations: [],
      },
      schema,
    ),
  ).toThrowError(expect.objectContaining({ code: "invalid_request" }));
  const old = createEvidenceRecord(
    { ...body(), kind: "benchmark", confidence: "measured" },
    schema,
  );
  expect(() =>
    promoteEvidence(
      old,
      {
        ...body(),
        id: newId,
        kind: "verify",
        confidence: "tested",
        parents: [old.id],
      },
      schema,
    ),
  ).toThrowError(expect.objectContaining({ code: "invalid_request" }));
});

test("unknowns round trip and resolution produces a new immutable record with an evidence reference", () => {
  const input = {
    id: `unk_01${"C".repeat(24)}`,
    question: "Does it work on another CPU?",
    domain: "portability",
    probe: "Run the portability lane.",
    status: "open",
  };
  const unknown = readUnknown(input);
  expect(readUnknown(JSON.parse(JSON.stringify(unknown)))).toEqual(unknown);
  const resolved = resolveUnknown(unknown, newId);
  expect(resolved).toMatchObject({ status: "resolved", resolved_by: newId });
  expect(unknown.status).toBe("open");
  expect(() => Object.assign(resolved, { status: "open" })).toThrow();
  expect(() => readUnknown({ ...input, status: "resolved" })).toThrow();
  expect(() => readUnknown({ ...input, resolved_by: newId })).toThrow();
  expect(() => resolveUnknown(resolved, oldId)).toThrow();
});
