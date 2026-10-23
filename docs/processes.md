# Process foundation

`runProcess` in `src/process/` launches a trusted provider executable with an argv
array and `shell: false`. It supports Linux/macOS process groups; Windows returns
`host_unsupported`. This is lifecycle management, not an execution sandbox. Candidate
code must go through the sandbox abstraction introduced by P0-12/P0-13.

Every invocation owns a private mode-0700 temporary directory. HOME and all temporary
location variables point there. The default cwd is that directory; callers may
supply a different cwd. The directory is removed before success or failure is
returned, including cancellation, deadline, and spawn-error paths.

The environment allowlist is PATH, LANG, LC_ALL, LC_CTYPE, TZ, CC, CXX, AR, RANLIB,
RUSTC, CARGO, and ZIG. Secrets and runtime injection variables are not inherited.
Executable and argv selection remain the caller's responsibility. No shell expansion
is performed and no command is retried automatically.

The process runs in a new process group. Deadline or cancellation sends SIGKILL to
the group. A normal parent exit also kills any remaining group members so descendants
cannot keep output pipes open. A descendant deliberately escaping its group requires
sandbox containment; process groups alone are not a hostile-code security boundary.

Both output streams continue to drain after their independent retention caps are
reached. Returned stdout/stderr are Buffers, preserving exact bytes; consumers choose
how to decode them. `output_truncated` flags indicate discarded bytes. Nonzero child
exit codes are returned for provider-specific interpretation. Each result includes
recovery text describing effective limits, source, bounds, restart policy, and limits
that remain unchanged.

| Setting                        | Default       | Inclusive range  |
| ------------------------------ | ------------- | ---------------- |
| `ALA_COMMAND_TIMEOUT_MS`       | 120000 ms     | 1–2147483647 ms  |
| `ALA_PROCESS_STDOUT_MAX_BYTES` | 1048576 bytes | 1–67108864 bytes |
| `ALA_PROCESS_STDERR_MAX_BYTES` | 1048576 bytes | 1–67108864 bytes |

The supplied environment snapshot is validated before launch. An AbortSignal permits
cancellation. Deadline and cancellation reject with typed errors after cleanup. A
missing executable or cwd returns `toolchain_missing`; other launch failures return
`internal`. Cleanup failures return `cleanup_incomplete`, retaining the operation
error code when applicable.

The integration tests launch real Node processes, including grandchildren. They
check heartbeat cessation after timeout/cancellation, private-directory removal,
exact output caps, environment scrubbing, nonzero exits, and literal shell-like argv.
These are process-lifecycle checks on the current host, not compiler or sandbox lanes.
