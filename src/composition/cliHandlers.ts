import type { CliHandlers } from "../cli/runCli.js";
import { startStdioServer } from "../main.js";

export function createCliHandlers(version: string): CliHandlers {
  return {
    async mcp({ transport }) {
      if (transport === "http") {
        return {
          exitCode: 1,
          stderr: "The MCP http service is not available in this build.\n",
        };
      }
      await startStdioServer(version);
      return { exitCode: 0 };
    },
    async doctor() {
      return {
        exitCode: 1,
        stderr: "Environment diagnostics are not available in this build.\n",
      };
    },
  };
}
