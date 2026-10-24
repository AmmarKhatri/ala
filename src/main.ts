import type { DoctorHandler } from "./application/doctor.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server/createServer.js";

export async function startStdioServer(version: string, doctor: DoctorHandler) {
  const server = createServer(version, doctor);
  await server.connect(new StdioServerTransport());
  process.stdin.once("end", () => {
    void server.close();
  });
  return server;
}
