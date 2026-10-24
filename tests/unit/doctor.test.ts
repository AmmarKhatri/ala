import { expect, test, vi } from "vitest";
import { createDoctor } from "../../src/application/doctor.js";
import {
  doctorReport,
  type DoctorObservation,
} from "../../src/domain/env/doctorReport.js";
import { fingerprint } from "../../src/domain/env/fingerprint.js";

function observation(): DoctorObservation {
  const environment = fingerprint(
    {
      platform: "linux",
      architecture: "x64",
      kernel: "fixture",
      cpuInfo:
        "processor: 0\nmodel name: AMD Ryzen 7 7700\nphysical id: 0\ncore id: 0\nflags: sse2",
      governors: ["performance"],
      boost: "0",
      toolchains: Object.fromEntries(
        ["clang", "llvm-objdump", "llvm-mca"].map((name) => [
          name,
          { status: "available" as const, version: "fixture" },
        ]),
      ),
    },
    () => `unk_01${"A".repeat(24)}`,
  );
  environment.virtualization = "not_detected";
  return { environment, sandbox: "verified", perf: "permitted" };
}

test("all four checks have a passing fixture and remediation", () => {
  const result = doctorReport(observation());
  expect(result.checks.map((check) => check.status)).toEqual([
    "pass",
    "pass",
    "pass",
    "pass",
  ]);
  expect(result.checks.every((check) => check.remediation.length > 0)).toBe(
    true,
  );
});

test("all four checks have warning fixtures", () => {
  const input = observation();
  input.environment.toolchains["llvm-mca"] = {
    status: "missing",
    version: null,
  };
  input.environment.boost = "unknown";
  input.sandbox = "unverified";
  input.perf = "unknown";
  expect(doctorReport(input).checks.map((check) => check.status)).toEqual([
    "warn",
    "warn",
    "warn",
    "warn",
  ]);
});

test("all four checks have failing fixtures", () => {
  const input = observation();
  input.environment.toolchains = {};
  input.sandbox = "missing";
  input.perf = "restricted";
  expect(doctorReport(input).checks.map((check) => check.status)).toEqual([
    "fail",
    "fail",
    "fail",
    "fail",
  ]);
});

test("filtered checks and an explicitly empty selection are honored without mutation", async () => {
  const input = observation();
  const before = JSON.stringify(input);
  const inspect = vi.fn(async () => input);
  const doctor = createDoctor({ inspect });
  expect((await doctor(["sandbox"])).checks.map((check) => check.id)).toEqual([
    "sandbox",
  ]);
  expect((await doctor([])).checks).toEqual([]);
  expect(JSON.stringify(input)).toBe(before);
  expect(inspect).toHaveBeenCalledTimes(2);
});
