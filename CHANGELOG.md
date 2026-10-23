# Changelog

## Unreleased

### Added

- P0-06: fourteen typed error codes, schema-validated MCP error projection, safe
  internal errors, a throwing config adapter, and a generated error catalog.

- P0-05: Zod-validated fuzz-budget, command-timeout, and MCP response-size
  settings with explicit defaults and inclusive bounds, provenance, aggregated
  configuration issues, and recovery text. Limit enforcement remains with future consumers.

- P0-04: MCP stdio server with exact plan instructions, Zod-backed ping contract,
  validated structured results and provenance metadata, generated tool docs, and
  SDK contract tests including a real CLI subprocess.

- P0-03: `ala` CLI dispatcher with help, package version, stdio/HTTP MCP and
  doctor routes, strict argument validation, compiled builds, and executable tests.
  Unimplemented services report failure on stderr without claiming readiness.

- P0-02: dependency-cruiser layer enforcement in `npm run check`, including
  type-only provider ports, domain I/O restrictions, unresolved import detection,
  and real checker fixtures for valid and invalid dependency graphs.

- P0-01: ESM npm package foundation with strict TypeScript, Vitest, Biome,
  reproducible dependency installation, and a non-mutating `npm run check`.
- Contributor and agent instructions, architecture and development documentation,
  MIT license, and editor defaults.

### Changed

- Resolve ESM package exports in architecture checks for SDK subpath imports.

- Pin TypeScript to 6.0.3 for dependency-cruiser 18.7 parser compatibility;
  fail architecture checks if implementation files are not analyzed.
