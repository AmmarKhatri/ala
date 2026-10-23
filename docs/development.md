# Development

Install Node 24 LTS (recommended), then run `npm ci` from the repository root.
Node 22 users need at least 22.12 because of Vitest's engine requirement.
Dependencies are pinned in package.json and resolved in package-lock.json.

| Command                | Purpose                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| `npm run typecheck`    | Check TypeScript with strict mode; emit no files                     |
| `npm run lint`         | Check supported source and configuration files with Biome            |
| `npm run format:check` | Check Biome formatting without rewriting files                       |
| `npm test`             | Run unit tests once with Vitest                                      |
| `npm run check`        | Run typecheck, lint, format, architecture, tests, and generated docs |

Biome checks supported source, configuration, and Markdown files.
To apply formatting intentionally, run `npx biome format --write .`.
The initial smoke test validates the test runner only; it establishes no runtime,
compiler, correctness, or performance claims.

P0-02 provides architecture dependency enforcement (`npm run check:architecture`). P0-03 supplies the CLI dispatcher; P0-04 supplies the MCP stdio skeleton.
Run `npm run build` to compile `src/` into `dist/`, then
`node bin/ala.mjs --help`. Tests and package preparation run the build automatically.
See [CLI behavior](cli.md) for command support and exit statuses.

Run `npm run docs:generate` to regenerate tool schemas in `docs/tools.md`.
`npm run docs:check` compares the catalog against built contracts without writing.
The full check builds before checking the generated catalog.
