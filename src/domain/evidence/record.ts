import { z } from "zod";
import {
  IntegrityViolationError,
  InvalidRequestError,
} from "../errors/alaError.js";
import { canonicalJson, jsonDigest } from "./canonicalJson.js";
import { freezeRecord } from "./freezeRecord.js";

export const evidenceIdSchema = z
  .string()
  .regex(/^ev_[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const confidenceSchema = z.enum([
  "proven",
  "proven_bounded",
  "tested",
  "tested_low_coverage",
  "measured",
  "observed",
  "inferred",
  "unknown",
]);
export type Confidence = z.infer<typeof confidenceSchema>;
export const evidenceBodySchema = z.strictObject({
  id: evidenceIdSchema,
  kind: z.enum([
    "environment",
    "build",
    "listing",
    "static_analysis",
    "lint",
    "integrity_scan",
    "spec_validation",
    "verify",
    "fuzz",
    "sanitizer",
    "proof",
    "benchmark",
    "counters",
    "profile",
    "end_to_end",
    "patch",
    "cancelled",
    "injection_notice",
  ]),
  subject: z.strictObject({
    workspace_id: z.string().min(1),
    target_id: z.string().optional(),
    candidate_id: z.string().optional(),
    artifact_digests: z.array(sha256),
  }),
  tool: z.strictObject({
    name: z.string().min(1),
    version: z.string().min(1),
    argv: z.array(z.string()),
    exit_code: z.number().int().nullable(),
    duration_ms: z.number().nonnegative(),
  }),
  environment_id: z.string().min(1),
  confidence: confidenceSchema,
  summary: z.string().min(1),
  data: z.json(),
  limitations: z.array(z.string().min(1)),
  parents: z.array(evidenceIdSchema),
  created_at: z.iso.datetime({ offset: true }),
  prev_digest: sha256,
});
export const evidenceRecordSchema = evidenceBodySchema.extend({
  digest: sha256,
});
export type EvidenceRecord = Readonly<z.infer<typeof evidenceRecordSchema>>;

function checkMethod(body: z.infer<typeof evidenceBodySchema>) {
  const valid =
    body.confidence === "proven" || body.confidence === "proven_bounded"
      ? body.kind === "proof"
      : body.confidence === "tested" ||
          body.confidence === "tested_low_coverage"
        ? ["verify", "fuzz", "sanitizer", "spec_validation"].includes(body.kind)
        : body.confidence === "measured"
          ? ["benchmark", "counters", "profile", "end_to_end"].includes(
              body.kind,
            )
          : true;
  if (
    !valid ||
    (body.kind === "static_analysis" &&
      !["inferred", "unknown"].includes(body.confidence))
  )
    throw new InvalidRequestError({
      message: "The evidence method does not support this confidence.",
    });
  if (body.confidence === "proven_bounded" && body.limitations.length === 0)
    throw new InvalidRequestError({
      message: "Bounded proofs must state their limitations.",
    });
  if (
    ["tested", "tested_low_coverage", "proven", "proven_bounded"].includes(
      body.confidence,
    ) &&
    body.tool.exit_code !== 0
  )
    throw new InvalidRequestError({
      message: "Tested or proven evidence requires a successful method exit.",
    });
  if (body.parents.includes(body.id))
    throw new InvalidRequestError({
      message: "Evidence cannot cite itself as a parent.",
    });
}

export function createEvidenceRecord(
  input: unknown,
  dataSchema: z.ZodType,
): EvidenceRecord {
  canonicalJson(input);
  const parsed = evidenceBodySchema.safeParse(input);
  if (!parsed.success)
    throw new InvalidRequestError({ message: "Evidence metadata is invalid." });
  const body = parsed.data;
  const data = dataSchema.safeParse(body.data);
  if (!data.success)
    throw new InvalidRequestError({
      message: "Evidence data does not match its method schema.",
    });
  // Schemas may validate/refine but must not silently transform recorded evidence.
  if (canonicalJson(data.data) !== canonicalJson(body.data))
    throw new InvalidRequestError({
      message: "Evidence schemas must preserve the recorded data.",
    });
  checkMethod(body);
  return freezeRecord({ ...body, digest: jsonDigest(body) });
}

export function readEvidenceRecord(
  input: unknown,
  dataSchema: z.ZodType,
): EvidenceRecord {
  canonicalJson(input);
  const parsed = evidenceRecordSchema.safeParse(input);
  if (!parsed.success)
    throw new IntegrityViolationError({
      message: "Evidence record is malformed.",
    });
  const { digest, ...body } = parsed.data;
  const record = createEvidenceRecord(body, dataSchema);
  if (record.digest !== digest)
    throw new IntegrityViolationError({ message: "Evidence digest mismatch." });
  return record;
}

const stronger: Record<Confidence, readonly Confidence[]> = {
  unknown: [
    "inferred",
    "observed",
    "measured",
    "tested_low_coverage",
    "tested",
    "proven_bounded",
    "proven",
  ],
  inferred: [
    "observed",
    "measured",
    "tested_low_coverage",
    "tested",
    "proven_bounded",
    "proven",
  ],
  observed: [
    "measured",
    "tested_low_coverage",
    "tested",
    "proven_bounded",
    "proven",
  ],
  measured: [],
  tested_low_coverage: ["tested", "proven_bounded", "proven"],
  tested: ["proven_bounded", "proven"],
  proven_bounded: ["proven"],
  proven: [],
};

export function promoteEvidence(
  previous: EvidenceRecord,
  input: unknown,
  dataSchema: z.ZodType,
): EvidenceRecord {
  const parsed = evidenceRecordSchema.safeParse(previous);
  if (!parsed.success) throw new IntegrityViolationError();
  const { digest, ...oldBody } = parsed.data;
  if (jsonDigest(oldBody) !== digest) throw new IntegrityViolationError();
  const next = createEvidenceRecord(input, dataSchema);
  const sameSubject = ["workspace_id", "target_id", "candidate_id"] as const;
  const hasNewMethodOrData =
    previous.kind !== next.kind ||
    canonicalJson([
      previous.tool.name,
      previous.tool.version,
      previous.tool.argv,
    ]) !== canonicalJson([next.tool.name, next.tool.version, next.tool.argv]) ||
    canonicalJson(previous.data) !== canonicalJson(next.data);
  if (
    next.id === previous.id ||
    !next.parents.includes(previous.id) ||
    !stronger[previous.confidence].includes(next.confidence) ||
    !hasNewMethodOrData ||
    sameSubject.some((key) => previous.subject[key] !== next.subject[key])
  ) {
    throw new InvalidRequestError({
      message:
        "Promotion requires a new record for the same subject, stronger method evidence, and a citation to the previous record.",
    });
  }
  return next;
}
