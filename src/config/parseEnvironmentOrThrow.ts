import { ConfigurationInvalidError } from "../domain/errors/alaError.js";
import { parseEnvironment } from "./parseEnvironment.js";

export function parseEnvironmentOrThrow(
  environment: Readonly<Record<string, string | undefined>>,
) {
  const result = parseEnvironment(environment);
  if (result.success) return result.settings;
  throw new ConfigurationInvalidError({
    message: result.issues.map((issue) => issue.message).join(" "),
    remediation: {
      action: result.issues.map((issue) => issue.remediation.action).join(" "),
      restart_required: result.issues.some(
        (issue) => issue.remediation.restart_required,
      ),
    },
    details: { issues: result.issues },
  });
}
