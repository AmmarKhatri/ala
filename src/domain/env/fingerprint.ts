import { z } from "zod";
import { jsonDigest } from "../evidence/canonicalJson.js";
import { readUnknown, unknownSchema } from "../evidence/unknown.js";

export const toolchainProbeSchema = z.strictObject({
  status: z.enum(["available", "missing", "failed"]),
  version: z.string().nullable(),
});
export const environmentFingerprintSchema = z.strictObject({
  platform: z.enum(["linux", "darwin"]),
  architecture: z.string(),
  kernel: z.string(),
  cpu: z.strictObject({
    model: z.string(),
    features: z.array(z.string()),
    microarch: z.string(),
    microarch_confidence: z.enum(["inferred", "unknown"]),
    logical_cpus: z.number().int().positive().nullable(),
    physical_cores: z.number().int().positive().nullable(),
    smt: z.enum(["enabled", "disabled", "unknown"]),
    smt_siblings: z.array(z.array(z.number().int().nonnegative())).nullable(),
  }),
  governor: z.array(z.string()),
  boost: z.enum(["enabled", "disabled", "unknown"]),
  virtualization: z.enum(["detected", "not_detected", "unknown"]),
  toolchains: z.record(z.string(), toolchainProbeSchema),
  unknowns: z.array(unknownSchema),
  digest: z.string(),
});
export type ToolchainProbe = z.infer<typeof toolchainProbeSchema>;
export type Fingerprint = z.infer<typeof environmentFingerprintSchema>;

export interface HostObservation {
  platform: "linux" | "darwin";
  architecture: string;
  kernel: string;
  cpuInfo?: string;
  sysctl?: string;
  governors?: string[];
  boost?: string;
  noTurbo?: string;
  smtActive?: string;
  hypervisorType?: string;
  toolchains: Record<string, ToolchainProbe>;
}
const count = (value: string | undefined): number | null =>
  value && /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null;

export function fingerprint(
  observation: HostObservation,
  nextUnknownId: () => string,
): Fingerprint {
  const unknowns: z.infer<typeof unknownSchema>[] = [];
  const addUnknown = (
    question: string,
    domain: "performance" | "portability",
    probe: string,
  ) => {
    unknowns.push(
      readUnknown({
        id: nextUnknownId(),
        question,
        domain,
        probe,
        status: "open",
      }),
    );
  };
  const blocks = (observation.cpuInfo ?? "")
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((block) =>
      Object.fromEntries(
        block
          .split("\n")
          .filter((line) => line.includes(":"))
          .map((line) => {
            const index = line.indexOf(":");
            return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
          }),
      ),
    );
  const sysctl = Object.fromEntries(
    (observation.sysctl ?? "")
      .split("\n")
      .filter((line) => line.includes(":"))
      .map((line) => {
        const index = line.indexOf(":");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
  const model =
    observation.platform === "linux"
      ? (blocks[0]?.["model name"] ?? blocks[0]?.Hardware ?? "unknown")
      : (sysctl["machdep.cpu.brand_string"] ?? "unknown");
  let features: string[] = [];
  let logical: number | null = null;
  let physical: number | null = null;
  let smtSiblings: number[][] | null = null;
  if (observation.platform === "linux") {
    const processors = blocks.filter((block) => block.processor !== undefined);
    logical = processors.length || null;
    const flags = processors.map((block) =>
      (block.flags ?? block.Features ?? "").split(/\s+/).filter(Boolean),
    );
    features =
      flags[0]?.filter((flag) => flags.every((list) => list.includes(flag))) ??
      [];
    if (
      processors.length &&
      processors.every(
        (block) =>
          block["physical id"] !== undefined && block["core id"] !== undefined,
      )
    )
      physical = new Set(
        processors.map(
          (block) => `${block["physical id"]}:${block["core id"]}`,
        ),
      ).size;
  } else {
    logical = count(sysctl["hw.logicalcpu"]);
    physical = count(sysctl["hw.physicalcpu"]);
    features = [
      ...(sysctl["machdep.cpu.features"] ?? "")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean),
      ...(sysctl["machdep.cpu.leaf7_features"] ?? "")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean),
      ...Object.entries(sysctl)
        .filter(
          ([key, value]) => key.startsWith("hw.optional.") && value === "1",
        )
        .map(([key]) => key.slice("hw.optional.".length).toLowerCase()),
    ];
  }
  // Deliberately narrow mappings; unknown models must not inherit a tuning target.
  if (observation.platform === "linux" && physical !== null) {
    const groups = new Map<string, number[]>();
    for (const block of blocks.filter((item) => item.processor !== undefined)) {
      const key = `${block["physical id"]}:${block["core id"]}`;
      const ids = groups.get(key) ?? [];
      if (/^\d+$/.test(block.processor)) ids.push(Number(block.processor));
      groups.set(key, ids);
    }
    smtSiblings = [...groups.values()]
      .filter((ids) => ids.length > 1)
      .map((ids) => ids.sort((a, b) => a - b));
  } else if (logical !== null && logical === physical) smtSiblings = [];
  const microarch = /^AMD Ryzen 7 7700(?: 8-Core Processor)?$/.test(model)
    ? "zen4"
    : model === "Apple M1"
      ? "apple-m1"
      : model === "Apple M2"
        ? "apple-m2"
        : "unknown";
  if (microarch === "unknown")
    addUnknown(
      "What is this CPU's microarchitecture?",
      "portability",
      "Identify the CPU from vendor documentation and add a reviewed mapping.",
    );
  if (features.length === 0)
    addUnknown(
      "Which ISA features are available?",
      "portability",
      "Inspect per-CPU flags or supported sysctl feature keys.",
    );
  const governor = [...new Set(observation.governors ?? [])]
    .filter(Boolean)
    .sort();
  if (governor.length === 0)
    addUnknown(
      "Which CPU frequency policy is active?",
      "performance",
      "Inspect the host frequency controls before a rigorous benchmark.",
    );
  const boost =
    observation.boost === "1" || observation.noTurbo === "0"
      ? "enabled"
      : observation.boost === "0" || observation.noTurbo === "1"
        ? "disabled"
        : "unknown";
  if (boost === "unknown")
    addUnknown(
      "Is CPU boost enabled?",
      "performance",
      "Inspect host boost controls before a rigorous benchmark.",
    );
  const smt =
    observation.smtActive === "1"
      ? "enabled"
      : observation.smtActive === "0"
        ? "disabled"
        : logical !== null && physical !== null
          ? logical > physical
            ? "enabled"
            : "disabled"
          : "unknown";
  if (smt === "unknown")
    addUnknown(
      "What is the SMT topology?",
      "performance",
      "Inspect CPU sibling topology on the host.",
    );
  const virtualization =
    observation.hypervisorType ||
    features.includes("hypervisor") ||
    sysctl["kern.hv_vmm_present"] === "1"
      ? "detected"
      : sysctl["kern.hv_vmm_present"] === "0"
        ? "not_detected"
        : "unknown";
  if (virtualization === "unknown")
    addUnknown(
      "Is this environment virtualized?",
      "performance",
      "Check the host or hypervisor configuration; missing flags do not prove bare metal.",
    );
  for (const [name, probe] of Object.entries(observation.toolchains))
    if (probe.status !== "available")
      addUnknown(
        `Is ${name} available and usable?`,
        "portability",
        `Check the ${name} installation and version command.`,
      );
  const data = {
    platform: observation.platform,
    architecture: observation.architecture,
    kernel: observation.kernel,
    cpu: {
      model,
      features: [...new Set(features)].sort(),
      microarch,
      microarch_confidence: microarch === "unknown" ? "unknown" : "inferred",
      logical_cpus: logical,
      physical_cores: physical,
      smt,
      smt_siblings: smtSiblings,
    },
    governor,
    boost,
    virtualization,
    toolchains: observation.toolchains,
  };
  return environmentFingerprintSchema.parse({
    ...data,
    unknowns,
    digest: jsonDigest(data),
  });
}
