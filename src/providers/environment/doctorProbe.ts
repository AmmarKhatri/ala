import { access, readFile } from "node:fs/promises";
import type { DoctorObservation } from "../../domain/env/doctorReport.js";
import type { DoctorProbe } from "../ports/doctorProbe.js";
import { inspectHost } from "./inspectHost.js";

export const hostDoctorProbe: DoctorProbe = {
  async inspect(): Promise<DoctorObservation> {
    const environment = await inspectHost();
    const toolAvailable = ["docker", "bwrap"].some(
      (name) => environment.toolchains[name]?.status === "available",
    );
    const macSandbox =
      environment.platform === "darwin" &&
      (await access("/usr/bin/sandbox-exec")
        .then(() => true)
        .catch(() => false));
    const policy =
      environment.platform === "linux"
        ? await readFile("/proc/sys/kernel/perf_event_paranoid", "utf8")
            .then((value) =>
              /^-?\d+$/.test(value.trim()) ? Number(value.trim()) : null,
            )
            .catch(() => null)
        : null;
    return {
      environment,
      sandbox: toolAvailable || macSandbox ? "unverified" : "missing",
      perf:
        environment.platform === "darwin"
          ? "not_applicable"
          : policy === null
            ? "unknown"
            : policy <= 2
              ? "permitted"
              : "restricted",
    };
  },
};
