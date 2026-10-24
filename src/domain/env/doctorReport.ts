import { z } from "zod";
import { unknownSchema } from "../evidence/unknown.js";
import {
  environmentFingerprintSchema,
  type Fingerprint,
} from "./fingerprint.js";

export const doctorCheckSchema = z.enum([
  "toolchains",
  "sandbox",
  "perf_permissions",
  "benchmark_readiness",
]);
export type DoctorCheck = z.infer<typeof doctorCheckSchema>;
export const doctorReportSchema = z.strictObject({
  checks: z.array(
    z.strictObject({
      id: doctorCheckSchema,
      status: z.enum(["pass", "warn", "fail"]),
      summary: z.string(),
      remediation: z.string(),
    }),
  ),
  environment: environmentFingerprintSchema,
  evidence_ids: z.tuple([]),
  unknowns: z.array(unknownSchema),
  next_steps: z.array(z.string()),
});
export type DoctorReport = z.infer<typeof doctorReportSchema>;
export interface DoctorObservation {
  environment: Fingerprint;
  sandbox: "verified" | "unverified" | "missing";
  perf: "permitted" | "restricted" | "unknown" | "not_applicable";
}

export function doctorReport(
  observation: DoctorObservation,
  selected?: readonly DoctorCheck[],
): DoctorReport {
  const { environment } = observation;
  const available = Object.entries(environment.toolchains)
    .filter(([, tool]) => tool.status === "available")
    .map(([name]) => name);
  const compiler = available.includes("clang") || available.includes("gcc");
  const required = ["clang", "llvm-objdump", "llvm-mca"];
  const missing = required.filter((name) => !available.includes(name));
  const eligibleHost =
    (environment.platform === "linux" &&
      ["x64", "arm64"].includes(environment.architecture)) ||
    (environment.platform === "darwin" && environment.architecture === "arm64");
  const quietPolicy =
    environment.governor.length > 0 &&
    environment.governor.every((governor) => governor === "performance") &&
    environment.boost === "disabled" &&
    environment.virtualization === "not_detected" &&
    environment.cpu.smt !== "unknown";
  const checks: DoctorReport["checks"] = [
    {
      id: "toolchains",
      status: !compiler ? "fail" : missing.length ? "warn" : "pass",
      summary: !compiler
        ? "No C/C++ compiler version probe succeeded."
        : missing.length
          ? `Compiler found; missing or failed probes: ${missing.join(", ")}.`
          : "Compiler and LLVM utility version probes succeeded.",
      remediation:
        environment.platform === "darwin"
          ? "Install Xcode command-line tools and LLVM if needed, then make their executables available on PATH. Version probes do not validate compilation."
          : "Install Clang and LLVM tools using your distribution package manager and make them available on PATH. Version probes do not validate compilation.",
    },
    {
      id: "sandbox",
      status:
        observation.sandbox === "verified"
          ? "pass"
          : observation.sandbox === "missing"
            ? "fail"
            : "warn",
      summary:
        observation.sandbox === "verified"
          ? "A sandbox backend passed its availability probe."
          : observation.sandbox === "missing"
            ? "No supported sandbox backend was discovered."
            : "Sandbox tooling was discovered, but isolation has not been verified.",
      remediation:
        "Configure and verify a supported sandbox backend before running candidates. Do not bypass isolation to silence this check.",
    },
    {
      id: "perf_permissions",
      status:
        observation.perf === "permitted"
          ? "pass"
          : observation.perf === "restricted"
            ? "fail"
            : "warn",
      summary:
        observation.perf === "permitted"
          ? "Reported Linux policy permits per-process user-space counters; an actual counter run is still required."
          : observation.perf === "restricted"
            ? "Linux perf permissions restrict the intended counter access."
            : observation.perf === "not_applicable"
              ? "Linux perf permission checks do not apply to macOS."
              : "Perf permission policy could not be established.",
      remediation:
        "Review perf_event_paranoid and host capabilities on Linux; use supported macOS profiling tools on macOS. Doctor does not change permissions.",
    },
    {
      id: "benchmark_readiness",
      status:
        !eligibleHost || !compiler || observation.sandbox === "missing"
          ? "fail"
          : quietPolicy && observation.sandbox === "verified"
            ? "pass"
            : "warn",
      summary: !eligibleHost
        ? "This host is outside the v1 support matrix."
        : quietPolicy && observation.sandbox === "verified" && compiler
          ? "Observed prerequisites are suitable for a baseline noise assessment; performance validity is not established."
          : "Benchmark prerequisites are missing, unknown, or potentially noisy.",
      remediation:
        "Use a supported host with a verified sandbox, known frequency controls, and idle SMT siblings; run the A/A noise-floor assessment before claiming speedups.",
    },
  ];
  return doctorReportSchema.parse({
    checks:
      selected === undefined
        ? checks
        : checks.filter((check) => selected.includes(check.id)),
    environment,
    evidence_ids: [],
    unknowns: environment.unknowns,
    next_steps: [
      "Address failed checks and warnings before evaluating candidates.",
    ],
  });
}
