import type { CliHandlers } from "../cli/runCli.js";

// Replaced by service wiring as the MCP and doctor tasks land.
export const cliHandlers: CliHandlers = {
  async mcp({ transport }) {
    return {
      exitCode: 1,
      stderr: `The MCP ${transport} service is not available in this build.\n`,
    };
  },
  async doctor() {
    return {
      exitCode: 1,
      stderr: "Environment diagnostics are not available in this build.\n",
    };
  },
};
