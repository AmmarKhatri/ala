import type { DoctorHandler } from "../application/doctor.js";
import { InternalError } from "../application/errors.js";
import { doctorContract } from "../contracts/doctor.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import { pingContract } from "../contracts/ping.js";
import { registerContractTool } from "./registerContractTool.js";
import { serverInstructions } from "./serverInstructions.js";

export function createServer(
  version: string,
  doctor: DoctorHandler = async () => {
    throw new InternalError({ message: "Doctor service is not configured." });
  },
) {
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
  registerContractTool(server, doctorContract, ({ checks }) => doctor(checks));
  return server;
}
