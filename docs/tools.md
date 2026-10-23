# MCP tools

Generated from src/contracts/ by npm run docs:generate. Do not edit manually.

## ping

Check that ALA is responding. Does not check toolchain or benchmark readiness.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

Output schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "const": "ok"
    },
    "evidence_ids": {
      "type": "array",
      "prefixItems": [],
      "items": false,
      "maxItems": 0
    },
    "unknowns": {
      "type": "array",
      "prefixItems": [],
      "items": false,
      "maxItems": 0
    },
    "next_steps": {
      "type": "array",
      "prefixItems": [],
      "items": false,
      "maxItems": 0
    }
  },
  "required": [
    "status",
    "evidence_ids",
    "unknowns",
    "next_steps"
  ],
  "additionalProperties": false
}
```

Project-derived content: no.
