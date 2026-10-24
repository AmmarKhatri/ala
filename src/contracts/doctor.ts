import { z } from "zod";
import {
  doctorCheckSchema,
  doctorReportSchema,
} from "../domain/env/doctorReport.js";
import type { ToolContract } from "./toolContract.js";

const input = z.strictObject({ checks: z.array(doctorCheckSchema).optional() });
export const doctorContract = {
  name: "doctor",
  description:
    "Inspect host readiness and report corrective actions without changing host configuration.",
  input,
  output: doctorReportSchema,
  projectDerived: false,
  resultSource: "host_environment",
} satisfies ToolContract<typeof input.shape, typeof doctorReportSchema.shape>;
