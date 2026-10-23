import { expect, test } from "vitest";
import { limitRecoveryText } from "../../src/config/limitRecoveryText.js";
import {
  parseEnvironment,
  settings,
} from "../../src/config/parseEnvironment.js";

for (const setting of settings) {
  test(`${setting.name}: default, override, floor, and maximum`, () => {
    for (const raw of [
      undefined,
      String(setting.defaultValue + 1),
      String(setting.floor),
      String(setting.maximum),
      `  ${setting.floor}  `,
    ]) {
      const result = parseEnvironment({ [setting.name]: raw });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.settings[setting.name]).toEqual({
        definition: setting,
        value: raw === undefined ? setting.defaultValue : Number(raw),
        source: raw === undefined ? "default" : "setting",
      });
    }
  });

  test.each([
    "",
    " ",
    "1.5",
    "1e3",
    "0x10000",
    "+1",
    "-1",
    "NaN",
    "Infinity",
    "60s",
    "1_000",
    "１２",
    "9".repeat(400),
  ])(`${setting.name}: rejects invalid syntax %j`, (raw) => {
    const result = parseEnvironment({ [setting.name]: raw });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      code: "configuration_invalid",
      setting: setting.name,
      remediation: {
        setting: setting.name,
        restart_required: setting.restartRequired,
      },
    });
    expect(result.issues[0].remediation.action).toContain(
      `default ${setting.defaultValue} ${setting.unit}`,
    );
  });

  test(`${setting.name}: rejects values outside bounds without clamping`, () => {
    for (const value of [setting.floor - 1, setting.maximum + 1]) {
      const result = parseEnvironment({ [setting.name]: String(value) });
      expect(result.success).toBe(false);
      expect(result).not.toHaveProperty("settings");
    }
  });

  test(`${setting.name}: recovery text reports effective policy and next action`, () => {
    for (const raw of [undefined, String(setting.maximum)]) {
      const result = parseEnvironment({ [setting.name]: raw });
      if (!result.success)
        throw new Error("Expected valid configuration fixture");
      const text = limitRecoveryText(result.settings[setting.name]);
      expect(text).toContain(
        `${setting.name} value is ${raw ?? setting.defaultValue} ${setting.unit}`,
      );
      expect(text).toContain(
        `source: ${raw === undefined ? "default" : "setting"}`,
      );
      expect(text).toContain(
        `floor ${setting.floor} ${setting.unit}, maximum ${setting.maximum} ${setting.unit}`,
      );
      expect(text).toContain("in the environment that starts ALA.");
      expect(text).toContain(
        setting.restartRequired
          ? "Restart ALA after changing the environment."
          : "No restart is needed.",
      );
      expect(text).toContain(`This does not raise ${setting.doesNotRaise}.`);
    }
  });
}

test("fuzz recovery matches the plan example", () => {
  const result = parseEnvironment({});
  expect(result.success).toBe(true);
  if (!result.success) return;
  expect(limitRecoveryText(result.settings.ALA_FUZZ_BUDGET_S)).toBe(
    "The effective ALA_FUZZ_BUDGET_S value is 60 s (source: default; floor 1 s, maximum 86400 s). Pass `fuzz_budget_s` to evaluate_candidate for this call, or set ALA_FUZZ_BUDGET_S in the environment that starts ALA. No restart is needed. This does not raise the hidden input count.",
  );
});

test("collects all invalid settings without returning a partial configuration", () => {
  const result = parseEnvironment(
    Object.fromEntries(settings.map((setting) => [setting.name, "bad"])),
  );
  expect(result.success).toBe(false);
  if (result.success) return;
  expect(result.issues.map((issue) => issue.setting)).toEqual(
    settings.map((setting) => setting.name),
  );
  expect(result).not.toHaveProperty("settings");
});

test("parsing is repeatable, ignores unrelated environment keys, and does not mutate input", () => {
  const environment = Object.freeze({
    PATH: "/usr/bin",
    ALA_FUZZ_BUDGET_S: "120",
  });
  expect(parseEnvironment(environment)).toEqual(
    parseEnvironment({ ALA_FUZZ_BUDGET_S: "120" }),
  );
  expect(environment).toEqual({ PATH: "/usr/bin", ALA_FUZZ_BUDGET_S: "120" });
});

test("initial defaults and bounds match PLAN.md section 19.1", () => {
  expect(
    settings
      .slice(0, 3)
      .map(({ name, defaultValue, floor, maximum, unit, restartRequired }) => ({
        name,
        defaultValue,
        floor,
        maximum,
        unit,
        restartRequired,
      })),
  ).toEqual([
    {
      name: "ALA_FUZZ_BUDGET_S",
      defaultValue: 60,
      floor: 1,
      maximum: 86400,
      unit: "s",
      restartRequired: false,
    },
    {
      name: "ALA_COMMAND_TIMEOUT_MS",
      defaultValue: 120000,
      floor: 1,
      maximum: 2147483647,
      unit: "ms",
      restartRequired: false,
    },
    {
      name: "ALA_MCP_MAX_RESPONSE_BYTES",
      defaultValue: 1048576,
      floor: 65536,
      maximum: 67108864,
      unit: "bytes",
      restartRequired: true,
    },
  ]);
});
