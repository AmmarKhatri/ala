import type { DoctorObservation } from "../../domain/env/doctorReport.js";

export interface DoctorProbe {
  inspect(): Promise<DoctorObservation>;
}
