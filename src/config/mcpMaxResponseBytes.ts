import type { NumericSetting } from "./numericSetting.js";

export const ALA_MCP_MAX_RESPONSE_BYTES = {
  name: "ALA_MCP_MAX_RESPONSE_BYTES",
  defaultValue: 1048576,
  floor: 65536,
  maximum: 67108864,
  unit: "bytes",
  restartRequired: true,
  nextAction: "Use a resource URI for larger output, or",
  doesNotRaise: "provider output byte caps",
} as const satisfies NumericSetting;
