import type { NumericSetting } from "./numericSetting.js";

export const ALA_COMMAND_TIMEOUT_MS = {
  name: "ALA_COMMAND_TIMEOUT_MS",
  defaultValue: 120000,
  floor: 1,
  maximum: 2147483647,
  unit: "ms",
  restartRequired: false,
  doesNotRaise: "the fuzz budget or output byte caps",
} as const satisfies NumericSetting;
