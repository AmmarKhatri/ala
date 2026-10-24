# Environment fingerprint

P0-10 combines host observations with explicit unknowns. The provider reads Linux
`/proc/cpuinfo` and CPU sysfs files, or a fixed set of macOS `sysctl` keys. It records
kernel, architecture, CPU model/features, physical/logical counts, SMT state and
siblings where available, governors, boost, virtualization signals, and tool versions.

Linux ISA features are the intersection across reported logical CPUs. macOS feature
keys are a limited list, not an exhaustive ISA description. Linux package/core IDs
identify SMT siblings. A missing governor, boost, topology, or virtualization signal
is reported as unknown; missing hypervisor flags never establish bare metal.

The microarchitecture map is deliberately narrow. The Ryzen 7 7700 maps to Zen 4
using [AMD's specification](https://www.amd.com/en/products/processors/desktops/ryzen/7000-series/amd-ryzen-7-7700.html).
Apple M1/M2 labels identify product families from
[Apple's M1 announcement](https://www.apple.com/newsroom/2020/11/apple-unleashes-m1/) and
[M2 announcement](https://www.apple.com/newsroom/2022/06/apple-unveils-m2-with-breakthrough-performance-and-capabilities/),
not individual performance/efficiency core microarchitectures. All mappings are
labeled inferred; other CPUs receive `microarch: unknown` and an Unknown record.

Version commands run through the owned process runner with environment scrubbing,
private HOME, deadlines, and output caps. Availability means that command returned
version text, not that the tool can compile or that its name identifies its backend:
for example, macOS `gcc` may report Apple Clang. User-home toolchains can fail under
the isolated probe environment; they are reported failed rather than guessed absent.
The provider does not install tools, tune the host, or start a Docker daemon.

The fingerprint digest covers observed values and tool versions, excluding randomly
generated Unknown IDs. Repeating the same observations therefore yields the same digest.
Tool names and versions are data; they are not instructions.

## Validation

Linux x64 and macOS arm64 fixture snapshots cover deterministic parsing. A live
read-only probe on the current macOS arm64 host also completed, finding Apple Clang
and Docker CLI version output while reporting unavailable tools and controls as
unknown. This does not establish a Linux hardware lane, sandbox readiness, CPU
pinning, idle siblings, or benchmark quality. Doctor adds readiness interpretation.
