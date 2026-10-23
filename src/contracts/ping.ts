import { z } from "zod";
import type { ToolContract } from "./toolContract.js";

const input = z.strictObject({});
const output = z.strictObject({
  status: z.literal("ok"),
  evidence_ids: z.tuple([]),
  unknowns: z.tuple([]),
  next_steps: z.tuple([]),
});

export const pingContract = {
  name: "ping",
  description:
    "Check that ALA is responding. Does not check toolchain or benchmark readiness.",
  input,
  output,
  projectDerived: false,
} satisfies ToolContract<typeof input.shape, typeof output.shape>;
