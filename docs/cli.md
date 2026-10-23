# CLI dispatcher

Build with `npm run build`, then run `node bin/ala.mjs <command>`.
The npm package maps the `ala` executable to `bin/ala.mjs`; `npm link` can make it
available locally as `ala`. No global installation is required for development.

| Invocation                               | Behavior                                                | Exit status     |
| ---------------------------------------- | ------------------------------------------------------- | --------------- |
| `ala` / `ala --help` / `ala -h`          | Print help on stdout                                    | 0               |
| `ala --version`                          | Print the version from the installed package.json       | 0               |
| `ala mcp`                                | Dispatch to the stdio MCP handler                       | 1 in this build |
| `ala mcp --http`                         | Dispatch to the HTTP MCP handler                        | 1 in this build |
| `ala doctor`                             | Dispatch to the environment diagnostics handler         | 1 in this build |
| `ala mcp --help` / `ala doctor --help`   | Print help without starting a service (`-h` also works) | 0               |
| Unknown command, flag, or extra argument | Print an error and help on stderr                       | 2               |

The MCP and diagnostics handlers currently report that the service is unavailable;
they do not start a server, inspect the host, or modify the system. Their errors go
to stderr, leaving stdout free for future MCP stdio messages.

The launcher resolves its package metadata and compiled modules relative to itself,
so it can run from any working directory. A missing build produces a recovery
message on stderr and exits with status 1. Run `npm run build` and retry.

`npm test` builds first and tests both dispatch routing and the actual executable.
`npm pack` builds first and includes the launcher and compiled modules.
