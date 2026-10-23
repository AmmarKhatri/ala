# Configuration foundation

P0-05 provides three initial numeric setting modules, a pure `parseEnvironment(environment)`
function, and `limitRecoveryText(effectiveSetting)`. P0-07 consumes the command deadline and adds independent stdout/stderr caps in the
[process runner](processes.md). Fuzz and MCP budgets remain foundations for later services.

| Setting                      | Default         | Inclusive range                | Unit         | Restart required by policy |
| ---------------------------- | --------------- | ------------------------------ | ------------ | -------------------------- |
| `ALA_FUZZ_BUDGET_S`          | 60              | 1–86400                        | seconds      | No                         |
| `ALA_COMMAND_TIMEOUT_MS`     | 120000          | 1–2147483647                   | milliseconds | No                         |
| `ALA_MCP_MAX_RESPONSE_BYTES` | 1048576 (1 MiB) | 65536–67108864 (64 KiB–64 MiB) | bytes        | Yes                        |

Each setting has its own module under `src/config/`. Its exported named constant
owns the default, bounds, unit, restart policy, and recovery guidance from PLAN.md
§19. Settings not listed above are deferred to the tasks that consume them.

Parsing accepts an explicit, read-only environment map; it does not read or mutate
`process.env`. Missing or undefined values select the default. Explicit values use
base-10 digits, with surrounding whitespace and leading zeroes permitted. Blank
values, fractions, signs, exponents, hex, unit suffixes, nonfinite values, and values
outside the inclusive range are rejected. Values are never silently clamped.
Unrelated environment variables are ignored.

On success, the result is `{ success: true, settings }`, keyed by setting name.
Each entry contains `definition`, `value`, and `source` (`default` or `setting`).
On failure, the result is `{ success: false, issues }`; all invalid registered
settings are reported in registration order and no partial configuration is returned.
Issues carry `configuration_invalid`, the setting name, a message, and structured
remediation. Invalid raw input is not echoed. `parseEnvironmentOrThrow` converts invalid results into a shared
`ConfigurationInvalidError`, preserving all issues and recovery actions. The original
parser continues to return data rather than throwing exceptions.

Recovery text reports the effective value, unit, source, floor, maximum, next action,
where to configure it, restart policy, and which other limits remain unchanged.
For the default fuzz budget:

> The effective ALA_FUZZ_BUDGET_S value is 60 s (source: default; floor 1 s, maximum 86400 s). Pass `fuzz_budget_s` to evaluate_candidate for this call, or set ALA_FUZZ_BUDGET_S in the environment that starts ALA. No restart is needed. This does not raise the hidden input count.

Restart flags describe the intended service policy. This foundation does not watch
the environment or apply per-call overrides: callers explicitly parse a new snapshot.
Changing a parent shell's environment cannot update an already-running process.
Per-call overrides and actual limit enforcement arrive with their consuming services.
