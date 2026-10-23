import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import type { ToolContract } from "../contracts/toolContract.js";

export function registerContractTool<
  I extends z.ZodRawShape,
  O extends z.ZodRawShape,
>(
  server: McpServer,
  contract: ToolContract<I, O>,
  handler: (
    input: z.output<z.ZodObject<I>>,
  ) => z.input<z.ZodObject<O>> | Promise<z.input<z.ZodObject<O>>>,
) {
  return server.registerTool<z.ZodObject<O>, z.ZodObject<I>>(
    contract.name,
    {
      description: contract.description,
      inputSchema: contract.input,
      outputSchema: contract.output,
    },
    async (args) => {
      const result = contract.output.parse(
        await handler(contract.input.parse(args)),
      );
      return {
        structuredContent: result,
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
        _meta: {
          provenance: contract.projectDerived
            ? { untrusted_content: true, source: "user_project" }
            : { untrusted_content: false, source: "ala_system" },
        },
      };
    },
  );
}
