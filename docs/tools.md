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

## doctor

Inspect host readiness and report corrective actions without changing host configuration.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "checks": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "toolchains",
          "sandbox",
          "perf_permissions",
          "benchmark_readiness"
        ]
      }
    }
  },
  "additionalProperties": false
}
```

Output schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "checks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "enum": [
              "toolchains",
              "sandbox",
              "perf_permissions",
              "benchmark_readiness"
            ]
          },
          "status": {
            "type": "string",
            "enum": [
              "pass",
              "warn",
              "fail"
            ]
          },
          "summary": {
            "type": "string"
          },
          "remediation": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "status",
          "summary",
          "remediation"
        ],
        "additionalProperties": false
      }
    },
    "environment": {
      "type": "object",
      "properties": {
        "platform": {
          "type": "string",
          "enum": [
            "linux",
            "darwin"
          ]
        },
        "architecture": {
          "type": "string"
        },
        "kernel": {
          "type": "string"
        },
        "cpu": {
          "type": "object",
          "properties": {
            "model": {
              "type": "string"
            },
            "features": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "microarch": {
              "type": "string"
            },
            "microarch_confidence": {
              "type": "string",
              "enum": [
                "inferred",
                "unknown"
              ]
            },
            "logical_cpus": {
              "anyOf": [
                {
                  "type": "integer",
                  "exclusiveMinimum": 0,
                  "maximum": 9007199254740991
                },
                {
                  "type": "null"
                }
              ]
            },
            "physical_cores": {
              "anyOf": [
                {
                  "type": "integer",
                  "exclusiveMinimum": 0,
                  "maximum": 9007199254740991
                },
                {
                  "type": "null"
                }
              ]
            },
            "smt": {
              "type": "string",
              "enum": [
                "enabled",
                "disabled",
                "unknown"
              ]
            },
            "smt_siblings": {
              "anyOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "array",
                    "items": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 9007199254740991
                    }
                  }
                },
                {
                  "type": "null"
                }
              ]
            }
          },
          "required": [
            "model",
            "features",
            "microarch",
            "microarch_confidence",
            "logical_cpus",
            "physical_cores",
            "smt",
            "smt_siblings"
          ],
          "additionalProperties": false
        },
        "governor": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "boost": {
          "type": "string",
          "enum": [
            "enabled",
            "disabled",
            "unknown"
          ]
        },
        "virtualization": {
          "type": "string",
          "enum": [
            "detected",
            "not_detected",
            "unknown"
          ]
        },
        "toolchains": {
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "type": "object",
            "properties": {
              "status": {
                "type": "string",
                "enum": [
                  "available",
                  "missing",
                  "failed"
                ]
              },
              "version": {
                "type": [
                  "string",
                  "null"
                ]
              }
            },
            "required": [
              "status",
              "version"
            ],
            "additionalProperties": false
          }
        },
        "unknowns": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "pattern": "^unk_[0-7][0-9A-HJKMNP-TV-Z]{25}$"
              },
              "question": {
                "type": "string",
                "minLength": 1
              },
              "domain": {
                "type": "string",
                "enum": [
                  "correctness",
                  "performance",
                  "portability",
                  "integration",
                  "spec"
                ]
              },
              "probe": {
                "type": "string",
                "minLength": 1
              },
              "status": {
                "type": "string",
                "enum": [
                  "open",
                  "resolved",
                  "wont_fix"
                ]
              },
              "resolved_by": {
                "type": "string",
                "pattern": "^ev_[0-7][0-9A-HJKMNP-TV-Z]{25}$"
              }
            },
            "required": [
              "id",
              "question",
              "domain",
              "probe",
              "status"
            ],
            "additionalProperties": false
          }
        },
        "digest": {
          "type": "string"
        }
      },
      "required": [
        "platform",
        "architecture",
        "kernel",
        "cpu",
        "governor",
        "boost",
        "virtualization",
        "toolchains",
        "unknowns",
        "digest"
      ],
      "additionalProperties": false
    },
    "evidence_ids": {
      "type": "array",
      "prefixItems": [],
      "items": false,
      "maxItems": 0
    },
    "unknowns": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^unk_[0-7][0-9A-HJKMNP-TV-Z]{25}$"
          },
          "question": {
            "type": "string",
            "minLength": 1
          },
          "domain": {
            "type": "string",
            "enum": [
              "correctness",
              "performance",
              "portability",
              "integration",
              "spec"
            ]
          },
          "probe": {
            "type": "string",
            "minLength": 1
          },
          "status": {
            "type": "string",
            "enum": [
              "open",
              "resolved",
              "wont_fix"
            ]
          },
          "resolved_by": {
            "type": "string",
            "pattern": "^ev_[0-7][0-9A-HJKMNP-TV-Z]{25}$"
          }
        },
        "required": [
          "id",
          "question",
          "domain",
          "probe",
          "status"
        ],
        "additionalProperties": false
      }
    },
    "next_steps": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "checks",
    "environment",
    "evidence_ids",
    "unknowns",
    "next_steps"
  ],
  "additionalProperties": false
}
```

Project-derived content: no.
