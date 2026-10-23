import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, test } from "vitest";
import { z } from "zod";
import * as errors from "../../src/application/errors.js";
import { alaErrorPayloadSchema } from "../../src/contracts/alaErrorPayload.js";
import { errorCatalog } from "../../src/domain/errors/errorCatalog.js";
import { createServer } from "../../src/server/createServer.js";
import { errorResult } from "../../src/server/errorResult.js";
import { registerContractTool } from "../../src/server/registerContractTool.js";

const cases = [
  ["invalid_request", errors.InvalidRequestError],
  ["configuration_invalid", errors.ConfigurationInvalidError],
  ["not_found", errors.NotFoundError],
  ["ineligible_target", errors.IneligibleTargetError],
  ["spec_invalid", errors.SpecInvalidError],
  ["toolchain_missing", errors.ToolchainMissingError],
  ["sandbox_unavailable", errors.SandboxUnavailableError],
  ["resource_limit", errors.ResourceLimitError],
  ["deadline_exceeded", errors.DeadlineExceededError],
  ["cancelled", errors.CancelledError],
  ["cleanup_incomplete", errors.CleanupIncompleteError],
  ["host_unsupported", errors.HostUnsupportedError],
  ["integrity_violation", errors.IntegrityViolationError],
  ["internal", errors.InternalError],
] as const;

test("all plan codes have a catalog entry and typed subclass", () => {
  expect(Object.keys(errorCatalog)).toEqual(cases.map(([code]) => code));
});

test.each(cases)(
  "%s is reachable over MCP with recovery text",
  async (code, ErrorClass) => {
    const error = new ErrorClass();
    expect(error).toBeInstanceOf(errors.AlaError);
    expect(error).toBeInstanceOf(Error);
    const server = createServer("test");
    const client = new Client({ name: "error-test", version: "1" });
    registerContractTool(
      server,
      {
        name: "fail",
        description: "Test fixture",
        input: z.strictObject({}),
        output: z.strictObject({ ok: z.boolean() }),
        projectDerived: true,
      },
      () => {
        throw error;
      },
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const result = await client.callTool({ name: "fail", arguments: {} });
      expect(result.isError).toBe(true);
      const payload = alaErrorPayloadSchema.parse(result.structuredContent);
      expect(payload.code).toBe(code);
      expect(payload.remediation.action.length).toBeGreaterThan(0);
      expect(payload.retryable).toBe(false);
      expect(result.content).toEqual([
        { type: "text", text: JSON.stringify(payload) },
      ]);
      expect(result._meta).toEqual({
        provenance: { untrusted_content: true, source: "user_project" },
      });
    } finally {
      await client.close();
      await server.close();
    }
  },
);

test.each([
  new Error("secret exception"),
  "secret string",
  { code: "not_found", message: "secret object" },
  null,
])("unknown errors do not leak details", (error) => {
  const result = errorResult(error);
  expect(result.structuredContent).toEqual(
    new errors.InternalError().toPayload(),
  );
  expect(JSON.stringify(result)).not.toContain("secret");
  expect(result.structuredContent).not.toHaveProperty("stack");
});

test("typed errors preserve explicit public context", () => {
  const error = new errors.ResourceLimitError({
    message: "Output budget reached.",
    remediation: {
      action:
        "Set ALA_MCP_MAX_RESPONSE_BYTES in the environment that starts ALA.",
      setting: "ALA_MCP_MAX_RESPONSE_BYTES",
      restart_required: true,
    },
    details: { effective: 1048576 },
    evidence_ids: ["ev_1"],
  });
  expect(
    alaErrorPayloadSchema.parse(errorResult(error).structuredContent),
  ).toEqual(error.toPayload());
});

test("non-JSON details safely become internal errors", () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  for (const details of [
    cyclic,
    { value: Number.NaN },
    { value: 1n },
    { value: undefined },
  ]) {
    expect(
      errorResult(new errors.NotFoundError({ details })).structuredContent,
    ).toEqual(new errors.InternalError().toPayload());
  }
});
