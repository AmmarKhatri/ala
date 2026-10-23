import type { NumericSetting } from "./numericSetting.js";

export const ALA_PROCESS_STDERR_MAX_BYTES = {
  name: "ALA_PROCESS_STDERR_MAX_BYTES",
  defaultValue: 1048576,
  floor: 1,
  maximum: 67108864,
  unit: "bytes",
  restartRequired: false,
  doesNotRaise: "the stdout cap or MCP response budget",
} as const satisfies NumericSetting;
