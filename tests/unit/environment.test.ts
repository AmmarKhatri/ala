import { expect, test } from "vitest";
import {
  fingerprint,
  type HostObservation,
} from "../../src/domain/env/fingerprint.js";

function parse(observation: HostObservation) {
  let count = 0;
  return fingerprint(
    observation,
    () => `unk_01${String(++count).padStart(24, "0")}`,
  );
}
const linux: HostObservation = {
  platform: "linux",
  architecture: "x64",
  kernel: "fixture-linux",
  cpuInfo:
    "processor : 0\nmodel name : AMD Ryzen 7 7700 8-Core Processor\nphysical id : 0\ncore id : 0\nflags : avx2 sse2 hypervisor\n\nprocessor : 1\nmodel name : AMD Ryzen 7 7700 8-Core Processor\nphysical id : 0\ncore id : 0\nflags : sse2 hypervisor\n",
  governors: ["performance"],
  boost: "0",
  smtActive: "1",
  toolchains: { clang: { status: "available", version: "clang fixture" } },
};
const mac: HostObservation = {
  platform: "darwin",
  architecture: "arm64",
  kernel: "fixture-darwin",
  sysctl:
    "machdep.cpu.brand_string: Apple M1\nhw.physicalcpu: 8\nhw.logicalcpu: 8\nkern.hv_vmm_present: 0\nhw.optional.neon: 1\nhw.optional.arm.FEAT_AES: 1",
  toolchains: {},
};

test("Linux fixture captures features common to all CPUs, frequency, SMT, and virtualization", () => {
  const result = parse(linux);
  expect(result.cpu).toEqual({
    model: "AMD Ryzen 7 7700 8-Core Processor",
    features: ["hypervisor", "sse2"],
    microarch: "zen4",
    microarch_confidence: "inferred",
    logical_cpus: 2,
    physical_cores: 1,
    smt: "enabled",
    smt_siblings: [[0, 1]],
  });
  expect(result).toMatchObject({
    governor: ["performance"],
    boost: "disabled",
    virtualization: "detected",
    unknowns: [],
  });
  expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
});

test("macOS fixture preserves unavailable frequency data as unknown", () => {
  const result = parse(mac);
  expect(result.cpu).toEqual({
    model: "Apple M1",
    features: ["arm.feat_aes", "neon"],
    microarch: "apple-m1",
    microarch_confidence: "inferred",
    logical_cpus: 8,
    physical_cores: 8,
    smt: "disabled",
    smt_siblings: [],
  });
  expect(result).toMatchObject({
    governor: [],
    boost: "unknown",
    virtualization: "not_detected",
  });
  expect(result.unknowns.map((unknown) => unknown.question)).toEqual([
    "Which CPU frequency policy is active?",
    "Is CPU boost enabled?",
  ]);
});

test("unknown CPU has an explicit Unknown record instead of a guessed mapping", () => {
  const result = parse({
    ...linux,
    cpuInfo: linux.cpuInfo?.replaceAll(
      "AMD Ryzen 7 7700 8-Core Processor",
      "Unrecognized CPU",
    ),
  });
  expect(result.cpu.microarch).toBe("unknown");
  expect(result.unknowns[0]).toMatchObject({
    status: "open",
    domain: "portability",
    question: "What is this CPU's microarchitecture?",
  });
});

test("missing probes do not imply readiness or bare metal", () => {
  const result = parse({
    platform: "linux",
    architecture: "arm64",
    kernel: "fixture",
    toolchains: { zig: { status: "missing", version: null } },
  });
  expect(result.cpu).toMatchObject({
    model: "unknown",
    physical_cores: null,
    logical_cpus: null,
    smt: "unknown",
  });
  expect(result.virtualization).toBe("unknown");
  expect(result.unknowns.some((item) => item.question.includes("zig"))).toBe(
    true,
  );
});

test("fingerprint digest is independent of unknown record IDs and changes with observations", () => {
  const one = parse(mac);
  const two = fingerprint(mac, () => `unk_01${"Z".repeat(24)}`);
  expect(one.digest).toBe(two.digest);
  expect(parse({ ...mac, kernel: "different" }).digest).not.toBe(one.digest);
});

test("Linux and macOS host fixtures match reviewed snapshots", () => {
  expect(parse(linux)).toMatchSnapshot("linux-x64");
  expect(parse(mac)).toMatchSnapshot("macos-arm64");
});
