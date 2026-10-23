import { expect, test } from "vitest";
import { parseEnvironment } from "../../src/config/parseEnvironment.js";
import { parseEnvironmentOrThrow } from "../../src/config/parseEnvironmentOrThrow.js";
import { ConfigurationInvalidError } from "../../src/domain/errors/alaError.js";
import { alaErrorPayloadSchema } from "../../src/contracts/alaErrorPayload.js";

test("throwing config adapter retains valid settings", () => {
  const result = parseEnvironment({});
  expect(result.success).toBe(true);
  if (result.success)
    expect(parseEnvironmentOrThrow({})).toEqual(result.settings);
});

test("throwing config adapter aggregates issues into a typed configuration error", () => {
  let caught: unknown;
  try {
    parseEnvironmentOrThrow({
      ALA_FUZZ_BUDGET_S: "bad",
      ALA_MCP_MAX_RESPONSE_BYTES: "bad",
    });
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ConfigurationInvalidError);
  if (!(caught instanceof ConfigurationInvalidError)) return;
  const payload = alaErrorPayloadSchema.parse(caught.toPayload());
  expect(payload.code).toBe("configuration_invalid");
  expect(payload.remediation.restart_required).toBe(true);
  expect(payload.message).toContain("ALA_FUZZ_BUDGET_S");
  expect(payload.message).toContain("ALA_MCP_MAX_RESPONSE_BYTES");
  expect(payload.details?.issues).toHaveLength(2);
});
