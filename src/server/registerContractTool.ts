import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import { InvalidRequestError } from "../application/errors.js";
import { errorResult } from "./errorResult.js";
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
  const source =
    contract.resultSource ??
    (contract.projectDerived ? "user_project" : "ala_system");
  const provenance = { untrusted_content: source !== "ala_system", source };
  return server.registerTool<z.ZodObject<O>, z.ZodObject<I>>(
    contract.name,
    {
      description: contract.description,
      inputSchema: contract.input,
      outputSchema: contract.output,
    },
    async (args) => {
      try {
        const input = contract.input.safeParse(args);
        if (!input.success) throw new InvalidRequestError();
        const result = contract.output.parse(await handler(input.data));
        return {
          structuredContent: result,
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
          _meta: {
            provenance,
          },
        };
      } catch (error) {
        return {
          ...errorResult(error, contract.projectDerived),
          _meta: { provenance },
        };
      }
    },
  );
}
