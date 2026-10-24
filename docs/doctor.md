# Doctor

Run `node bin/ala.mjs doctor` after building. MCP clients can call `doctor` with
`{}` or `{"checks":["toolchains","sandbox","perf_permissions","benchmark_readiness"]}`.
Omitting `checks` selects all; an explicit empty array returns no checks. The
CLI always requests all checks and emits JSON on stdout. Exit 1 means a failed
check; exit 0 may still include warnings and is not a benchmark-readiness certificate.

Each check includes pass/warn/fail, a summary, and a corrective action. The report
contains the environment fingerprint and unknowns, with empty evidence IDs because
no workspace evidence has been persisted. Host-derived text carries
`_meta.provenance = {"untrusted_content":true,"source":"host_environment"}`.
- Toolchain checks distinguish missing compilers from missing auxiliary LLVM tools.
  Version output is discovery, not a compiler execution test.
- Sandbox checks distinguish absent tooling from discovered but unverified backends.
  The current provider does not report verified isolation merely because a binary exists.
- Perf checks read Linux perf_event_paranoid; permitted policy still requires an
  actual counter test. macOS reports this Linux-specific check as a warning.
- Benchmark checks consider supported hosts, compiler availability, sandbox state,
  frequency controls, boost, virtualization, and known SMT. Even a passing fixture
  requires a subsequent A/A noise assessment before performance claims.

Doctor reads host information and runs version commands through private temporary
process environments. It does not install software, start daemons, change permissions,
modify power controls, or edit project files. Optional key selection filters reporting;
all read-only observations are currently collected before filtering.

Unit fixtures exercise pass, warn, and fail for every check. MCP tests validate
selection, schema output, and provenance. A live CLI probe on the current macOS host
reported warnings for missing auxiliary LLVM tools, unverified isolation, macOS perf
differences, and incomplete benchmark prerequisites.
