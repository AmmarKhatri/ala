import type { NumericSetting } from "./numericSetting.js";

export const ALA_FUZZ_BUDGET_S = {
  name: "ALA_FUZZ_BUDGET_S",
  defaultValue: 60,
  floor: 1,
  maximum: 86400,
  unit: "s",
  restartRequired: false,
  nextAction: "Pass `fuzz_budget_s` to evaluate_candidate for this call, or",
  doesNotRaise: "the hidden input count",
} as const satisfies NumericSetting;
