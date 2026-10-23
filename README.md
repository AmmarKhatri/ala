# ALA — Any Language Assembler

Any language that compiles to native code. Everything else through native extensions.

ALA is a planned MCP server and CLI for optimizing native functions with correctness
checks, measured performance, and reproducible receipts. See the
[language tiers](PLAN.md#2-what-any-language-means) for supported and planned use cases.

The development foundation, architecture checks, CLI dispatcher, and MCP stdio
skeleton are implemented. `ala mcp` serves a schema-backed `ping` tool. HTTP,
environment diagnostics, compiler integration, verification, and benchmarking
are not available yet.

## Development

Use Node 24 LTS (recommended). The development tools require Node 22.12+ on the
Node 22 line, Node 24+, or a newer supported even-numbered release.

```sh
npm ci
npm run check
```

After `npm run build`, try `node bin/ala.mjs --help` or `node bin/ala.mjs --version`.
See [CLI behavior](docs/cli.md) for available routes and [MCP setup](docs/mcp.md)
for connecting a client. The [configuration foundation](docs/configuration.md)
defines the initial settings for future services.

See [development commands](docs/development.md), [architecture](docs/architecture.md),
and [the implementation plan](PLAN.md). Contributors and agents must read
[AGENTS.md](AGENTS.md) before making changes.

License: [MIT](LICENSE).
