import { z } from "zod";
import { errorCatalog } from "../domain/errors/errorCatalog.js";

export const alaErrorPayloadSchema = z.strictObject({
  code: z.enum(
    Object.keys(errorCatalog) as [
      keyof typeof errorCatalog,
      ...Array<keyof typeof errorCatalog>,
    ],
  ),
  message: z.string().min(1),
  retryable: z.boolean(),
  remediation: z.strictObject({
    action: z.string().min(1),
    setting: z.string().optional(),
    restart_required: z.boolean().optional(),
  }),
  details: z.record(z.string(), z.json()).optional(),
  evidence_ids: z.array(z.string()).optional(),
});

export type AlaErrorPayload = z.infer<typeof alaErrorPayloadSchema>;
