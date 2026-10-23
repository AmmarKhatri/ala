import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import { pingContract } from "../contracts/ping.js";
import { registerContractTool } from "./registerContractTool.js";
import { serverInstructions } from "./serverInstructions.js";

export function createServer(version: string) {
  const server = new McpServer(
    { name: "ala-mcp", version },
    { instructions: serverInstructions },
  );
  registerContractTool(
    server,
    pingContract,
    (): z.input<typeof pingContract.output> => ({
      status: "ok",
      evidence_ids: [],
      unknowns: [],
      next_steps: [],
    }),
  );
  return server;
}
