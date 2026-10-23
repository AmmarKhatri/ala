import { ALA_COMMAND_TIMEOUT_MS } from "./commandTimeoutMs.js";
import { ALA_FUZZ_BUDGET_S } from "./fuzzBudgetS.js";
import { ALA_MCP_MAX_RESPONSE_BYTES } from "./mcpMaxResponseBytes.js";
import {
  type EffectiveSetting,
  numericSettingSchema,
} from "./numericSetting.js";

export const settings = [
  ALA_FUZZ_BUDGET_S,
  ALA_COMMAND_TIMEOUT_MS,
  ALA_MCP_MAX_RESPONSE_BYTES,
] as const;

type SettingName = (typeof settings)[number]["name"];
export type ParsedEnvironment = Record<SettingName, EffectiveSetting>;

export interface ConfigurationIssue {
  code: "configuration_invalid";
  setting: SettingName;
  message: string;
  remediation: {
    action: string;
    setting: SettingName;
    restart_required: boolean;
  };
}

export type EnvironmentResult =
  | { success: true; settings: ParsedEnvironment }
  | { success: false; issues: ConfigurationIssue[] };

export function parseEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): EnvironmentResult {
  const entries: Array<[SettingName, EffectiveSetting]> = [];
  const issues: ConfigurationIssue[] = [];
  for (const definition of settings) {
    const raw = environment[definition.name];
    if (raw === undefined) {
      entries.push([
        definition.name,
        { definition, value: definition.defaultValue, source: "default" },
      ]);
      continue;
    }
    const parsed = numericSettingSchema(definition).safeParse(raw);
    if (!parsed.success) {
      const range = `${definition.floor}–${definition.maximum} ${definition.unit}`;
      issues.push({
        code: "configuration_invalid",
        setting: definition.name,
        message: `${definition.name} must be a base-10 integer in ${range}.`,
        remediation: {
          action: `Set ${definition.name} to a base-10 integer in ${range} in the environment that starts ALA, or unset it to use the default ${definition.defaultValue} ${definition.unit}.`,
          setting: definition.name,
          restart_required: definition.restartRequired,
        },
      });
    } else {
      entries.push([
        definition.name,
        { definition, value: parsed.data, source: "setting" },
      ]);
    }
  }
  if (issues.length > 0) return { success: false, issues };
  // Every registered setting has an entry when there are no validation issues.
  return {
    success: true,
    settings: Object.fromEntries(entries) as ParsedEnvironment,
  };
}
