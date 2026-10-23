# Architecture

This is the intended architecture from PLAN.md §6. P0-01 and P0-02 supply development
tooling and layer enforcement. P0-03 adds argument dispatch in `src/cli/` and
service wiring in `src/composition/`. P0-04 implements MCP stdio initialization
and schema-backed tool registration; the optimization services below remain
unimplemented.
- CLI and MCP adapters call application services through shared contracts.
- Application services coordinate pure domain logic, storage, and provider ports.
- Domain modules contain no I/O and import no other layers.
- Providers wrap external tools through the process and sandbox foundations.
- Composition wires concrete providers into application services.
- The native C/assembly harness verifies and benchmarks candidates inside a sandbox.
- Storage retains content-addressed artifacts, evidence, and workspace state.

Application modules may import domain, store, and provider interfaces, never concrete
providers. Server and CLI modules import application and contracts only. Providers
import process, sandbox, and domain. P0-02 enforces these rules with dependency-cruiser.

Zod contracts will define MCP inputs and outputs. All speedup claims must come from
the verdict engine with evidence; inferred results remain labeled as such. See
[PLAN.md §0](../PLAN.md#0-how-to-use-this-document-read-first-llm-builders) for the golden rules.

## Enforced boundaries

Run `npm run check:architecture`, also included in `npm run check`.
Rules live in `.dependency-cruiser.cjs`. Imports within a layer are allowed.
Application services may only use type-only imports from provider interfaces in
`src/providers/ports/`; those interfaces may depend on domain types and other ports.
Concrete provider wiring belongs in `src/composition/`.

The resolver honors ESM package exports. The check includes TypeScript type-only
imports and re-exports and resolves `.js`
import specifiers to their TypeScript sources. Unresolved imports fail. Domain
imports of Node filesystem, process-spawning, worker, network, and interactive I/O
modules fail. This static check cannot prove the absence of I/O inside third-party
packages or dynamic runtime behavior; domain purity also requires code review.

External packages are not treated as internal layers. Layers without explicit
rules in PLAN.md §6.2 remain unconstrained. The checker accepts the empty source
tree during foundation work and fails if existing implementation files are skipped
by the parser. Dependency-cruiser 18.7 supports TypeScript below version 7, so
TypeScript is pinned to 6.0.3. Upgrade them together and rerun the boundary tests.

Unit fixtures run the real checker against permitted graphs and deliberate
violations, including type-only imports of concrete providers and runtime imports
of ports. Fixtures are created in temporary directories and removed after each test.

## CLI wiring

`bin/ala.mjs` reads package metadata and loads compiled CLI and composition modules.
`runCli` receives handlers for MCP (with an explicit stdio/HTTP transport choice)
and doctor, returning an exit code and optional stdout/stderr text. Parsing has no
process or filesystem dependencies. The launcher alone writes output and sets the
process exit code. Composition starts the stdio server through `src/main.ts`; HTTP and doctor
retain unavailable-service handlers. The server registration helper depends on
contracts, validates outputs, and attaches provenance metadata.
