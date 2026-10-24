import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, test } from "vitest";
import { doctorContract } from "../../src/contracts/doctor.js";
import { doctorReport } from "../../src/domain/env/doctorReport.js";
import { fingerprint } from "../../src/domain/env/fingerprint.js";
import { createServer } from "../../src/server/createServer.js";

test("doctor contract filters checks and marks host tool output as untrusted", async () => {
  const environment = fingerprint(
    {
      platform: "darwin",
      architecture: "arm64",
      kernel: "fixture",
      toolchains: {},
    },
    () => `unk_01${"B".repeat(24)}`,
  );
  const server = createServer("test", async (checks) =>
    doctorReport(
      { environment, sandbox: "missing", perf: "not_applicable" },
      checks,
    ),
  );
  const client = new Client({ name: "doctor-test", version: "1" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const result = await client.callTool({
      name: "doctor",
      arguments: { checks: ["sandbox"] },
    });
    expect(result.isError).not.toBe(true);
    const report = doctorContract.output.parse(result.structuredContent);
    expect(report.checks).toHaveLength(1);
    expect(report.checks[0]).toMatchObject({ id: "sandbox", status: "fail" });
    expect(result._meta).toEqual({
      provenance: { untrusted_content: true, source: "host_environment" },
    });
    const invalid = await client.callTool({
      name: "doctor",
      arguments: { checks: ["install_things"] },
    });
    expect(invalid.isError).toBe(true);
  } finally {
    await client.close();
    await server.close();
  }
});
