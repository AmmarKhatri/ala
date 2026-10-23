import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server/createServer.js";

export async function startStdioServer(version: string) {
  const server = createServer(version);
  await server.connect(new StdioServerTransport());
  process.stdin.once("end", () => {
    void server.close();
  });
  return server;
}
