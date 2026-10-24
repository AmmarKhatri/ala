import {
  doctorReport,
  type DoctorCheck,
  type DoctorReport,
} from "../domain/env/doctorReport.js";
import type { DoctorProbe } from "../providers/ports/doctorProbe.js";

export type DoctorHandler = (
  checks?: readonly DoctorCheck[],
) => Promise<DoctorReport>;
export function createDoctor(probe: DoctorProbe): DoctorHandler {
  return async (checks) => doctorReport(await probe.inspect(), checks);
}
