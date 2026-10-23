import { collectGarbage } from "../application/collectGarbage.js";
import { AlaError, InternalError } from "../application/errors.js";
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
    async gc(root, dryRun) {
      try {
        return {
          exitCode: 0,
          stdout: `${JSON.stringify(await collectGarbage(root, dryRun))}\n`,
        };
      } catch (error) {
        const payload = (
          error instanceof AlaError ? error : new InternalError()
        ).toPayload();
        return { exitCode: 1, stderr: `${JSON.stringify(payload)}\n` };
      }
    },
    async doctor() {
      return {
        exitCode: 1,
        stderr: "Environment diagnostics are not available in this build.\n",
      };
    },
  };
}
