import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AlaError, InternalError } from "../application/errors.js";
import { alaErrorPayloadSchema } from "../contracts/alaErrorPayload.js";

export function errorResult(
  error: unknown,
  projectDerived = false,
): CallToolResult {
  let payload = new InternalError().toPayload();
  if (error instanceof AlaError) {
    try {
      // Reject cycles, non-JSON detail values, and malformed error metadata.
      const serialized = JSON.stringify(error.toPayload());
      const parsed = alaErrorPayloadSchema.safeParse(error.toPayload());
      if (parsed.success && serialized) payload = parsed.data;
    } catch {
      // Unexpected details are not safe to expose as a tool response.
    }
  }
  return {
    isError: true,
    structuredContent: payload,
    content: [{ type: "text", text: JSON.stringify(payload) }],
    _meta: {
      provenance: projectDerived
        ? { untrusted_content: true, source: "user_project" }
        : { untrusted_content: false, source: "ala_system" },
    },
  };
}
