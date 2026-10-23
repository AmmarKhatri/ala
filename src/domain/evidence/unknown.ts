import { z } from "zod";
import { InvalidRequestError } from "../errors/alaError.js";
import { freezeRecord } from "./freezeRecord.js";
import { evidenceIdSchema } from "./record.js";

export const unknownSchema = z
  .strictObject({
    id: z.string().regex(/^unk_[0-7][0-9A-HJKMNP-TV-Z]{25}$/),
    question: z.string().min(1),
    domain: z.enum([
      "correctness",
      "performance",
      "portability",
      "integration",
      "spec",
    ]),
    probe: z.string().min(1),
    status: z.enum(["open", "resolved", "wont_fix"]),
    resolved_by: evidenceIdSchema.optional(),
  })
  .refine(
    (value) =>
      value.status === "resolved"
        ? value.resolved_by !== undefined
        : value.resolved_by === undefined,
    { message: "Only resolved unknowns must cite resolving evidence." },
  );
export type Unknown = Readonly<z.infer<typeof unknownSchema>>;

export function readUnknown(input: unknown): Unknown {
  const result = unknownSchema.safeParse(input);
  if (!result.success)
    throw new InvalidRequestError({ message: "Unknown record is invalid." });
  return freezeRecord(result.data);
}

export function resolveUnknown(previous: Unknown, evidenceId: string): Unknown {
  const current = readUnknown(previous);
  if (current.status !== "open")
    throw new InvalidRequestError({
      message: "Only open unknowns can be resolved.",
    });
  return readUnknown({
    ...current,
    status: "resolved",
    resolved_by: evidenceId,
  });
}
