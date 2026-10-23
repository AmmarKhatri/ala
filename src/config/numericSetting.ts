import { z } from "zod";

export interface NumericSetting {
  readonly name: string;
  readonly defaultValue: number;
  readonly floor: number;
  readonly maximum: number;
  readonly unit: string;
  readonly restartRequired: boolean;
  readonly nextAction?: string;
  readonly doesNotRaise: string;
}

export interface EffectiveSetting {
  readonly definition: NumericSetting;
  readonly value: number;
  readonly source: "default" | "setting";
}

export function numericSettingSchema(setting: NumericSetting) {
  return z
    .string()
    .trim()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(setting.floor).max(setting.maximum));
}
