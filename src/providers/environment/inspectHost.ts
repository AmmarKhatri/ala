import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { arch, platform, release } from "node:os";
import {
  fingerprint,
  type HostObservation,
  type ToolchainProbe,
} from "../../domain/env/fingerprint.js";
import {
  HostUnsupportedError,
  ConfigurationInvalidError,
  CleanupIncompleteError,
  ToolchainMissingError,
} from "../../domain/errors/alaError.js";
import { runProcess } from "../../process/runProcess.js";

const SYSCTL_KEYS = [
  "machdep.cpu.brand_string",
  "hw.physicalcpu",
  "hw.logicalcpu",
  "kern.hv_vmm_present",
  "machdep.cpu.features",
  "machdep.cpu.leaf7_features",
  "hw.optional.neon",
  "hw.optional.arm.FEAT_AES",
  "hw.optional.arm.FEAT_SHA256",
  "hw.optional.arm.FEAT_SHA512",
  "hw.optional.arm.FEAT_CRC32",
  "hw.optional.arm.FEAT_LSE",
];
const TOOLCHAINS = [
  "clang",
  "gcc",
  "rustc",
  "zig",
  "llvm-objdump",
  "llvm-mca",
  "perf",
  "docker",
  "bwrap",
];
const optionalFile = async (path: string) =>
  readFile(path, "utf8")
    .then((value) => value.trim())
    .catch(() => undefined);

function unknownId() {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let value =
    (BigInt(Date.now()) << 80n) |
    BigInt(`0x${randomBytes(10).toString("hex")}`);
  let id = "";
  for (let i = 0; i < 26; i++) {
    id = alphabet[Number(value & 31n)] + id;
    value >>= 5n;
  }
  return `unk_${id}`;
}

export async function inspectHost() {
  const host = platform();
  if (host !== "linux" && host !== "darwin") throw new HostUnsupportedError();
  const toolchains: Record<string, ToolchainProbe> = {};
  for (const name of TOOLCHAINS) {
    try {
      const result = await runProcess({ command: name, args: ["--version"] });
      const version =
        result.stdout.toString().trim() || result.stderr.toString().trim();
      toolchains[name] =
        result.exitCode === 0 && version
          ? { status: "available", version: version.split("\n")[0] }
          : { status: "failed", version: null };
    } catch (error) {
      if (
        error instanceof ConfigurationInvalidError ||
        error instanceof CleanupIncompleteError
      )
        throw error;
      toolchains[name] = {
        status: error instanceof ToolchainMissingError ? "missing" : "failed",
        version: null,
      };
    }
  }
  const observation: HostObservation = {
    platform: host,
    architecture: arch(),
    kernel: release(),
    toolchains,
  };
  if (host === "linux") {
    observation.cpuInfo = await optionalFile("/proc/cpuinfo");
    observation.boost = await optionalFile(
      "/sys/devices/system/cpu/cpufreq/boost",
    );
    observation.noTurbo = await optionalFile(
      "/sys/devices/system/cpu/intel_pstate/no_turbo",
    );
    observation.smtActive = await optionalFile(
      "/sys/devices/system/cpu/smt/active",
    );
    observation.hypervisorType = await optionalFile("/sys/hypervisor/type");
    const cpus = await readdir("/sys/devices/system/cpu").catch(() => []);
    observation.governors = (
      await Promise.all(
        cpus
          .filter((cpu) => /^cpu\d+$/.test(cpu))
          .map((cpu) =>
            optionalFile(
              `/sys/devices/system/cpu/${cpu}/cpufreq/scaling_governor`,
            ),
          ),
      )
    ).filter((value): value is string => value !== undefined);
  } else {
    try {
      const result = await runProcess({
        command: "/usr/sbin/sysctl",
        args: SYSCTL_KEYS,
      });
      observation.sysctl = result.stdout.toString();
    } catch (error) {
      if (
        error instanceof ConfigurationInvalidError ||
        error instanceof CleanupIncompleteError
      )
        throw error;
      observation.sysctl = "";
    }
  }
  return fingerprint(observation, unknownId);
}
