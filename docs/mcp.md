# MCP stdio server

Build the checkout with `npm ci` and `npm run build`, then configure an MCP client:

```json
{
  "mcpServers": {
    "ala": {
      "command": "node",
      "args": ["/absolute/path/to/ala/bin/ala.mjs", "mcp"]
    }
  }
}
```

The client launches ALA and exchanges MCP messages over stdin/stdout. No network
listener or authentication credentials are needed. Initialization advertises
`ala-mcp`, the installed package version, and PLAN.md §10.5 instructions verbatim.

The only tool in this skeleton is `ping`. Call it with `{}`; it returns status
`ok` and empty `evidence_ids`, `unknowns`, and `next_steps` arrays. It confirms
protocol responsiveness, not compiler availability or benchmark readiness.
Unexpected input fields are rejected. See [generated schemas](tools.md).

The registration helper validates both input and output with Zod and advertises
both schemas. Successful results contain `structuredContent` and an equivalent
JSON text block. Project-derived results carry
`_meta.provenance = { "untrusted_content": true, "source": "user_project" }`.
The system-generated ping uses `untrusted_content: false` and `source: "ala_system"`.
The marker is metadata; project text must still be treated as data by clients.

Typed application errors now return `isError: true` with the [ALA error payload](errors.md)
in `structuredContent` and equivalent JSON text. Unexpected exceptions and invalid
handler output become safe `internal` errors without raw exception text or stacks.
SDK-owned pre-handler input validation and unknown-tool dispatch retain SDK responses.
HTTP, resources, prompts, long-running tools, and full schema profiles are not
implemented in this skeleton.

Contracts live in `src/contracts/`. Run `npm run docs:generate` after changing them;
`npm run check` detects stale generated tool documentation. Do not edit
`docs/tools.md` manually. Contract tests use the official SDK over both linked
in-memory transports and a real CLI subprocess over stdio.
