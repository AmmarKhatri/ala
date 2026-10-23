import type { EffectiveSetting } from "./numericSetting.js";

export function limitRecoveryText(effective: EffectiveSetting): string {
  const { definition: setting, value, source } = effective;
  const action = setting.nextAction ? `${setting.nextAction} set` : "Set";
  const restart = setting.restartRequired
    ? "Restart ALA after changing the environment."
    : "No restart is needed.";
  return `The effective ${setting.name} value is ${value} ${setting.unit} (source: ${source}; floor ${setting.floor} ${setting.unit}, maximum ${setting.maximum} ${setting.unit}). ${action} ${setting.name} in the environment that starts ALA. ${restart} This does not raise ${setting.doesNotRaise}.`;
}
