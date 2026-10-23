export const errorCatalog = {
  invalid_request: {
    message: "The request is invalid.",
    retryable: false,
    action: "Correct the request using the advertised input schema.",
  },
  configuration_invalid: {
    message: "Configuration is invalid.",
    retryable: false,
    action: "Correct the reported setting in the environment that starts ALA.",
  },
  not_found: {
    message: "The requested item was not found.",
    retryable: false,
    action: "Check the identifier and select an existing item.",
  },
  ineligible_target: {
    message: "The target is not eligible.",
    retryable: false,
    action:
      "Select a supported target after reviewing the eligibility details.",
  },
  spec_invalid: {
    message: "The function specification is invalid.",
    retryable: false,
    action: "Correct the FunctionSpec and validate it against the baseline.",
  },
  toolchain_missing: {
    message: "A required toolchain is unavailable.",
    retryable: false,
    action: "Install the required toolchain and run doctor before retrying.",
  },
  sandbox_unavailable: {
    message: "The required sandbox is unavailable.",
    retryable: false,
    action:
      "Configure an available sandbox backend and retry; do not bypass isolation.",
  },
  resource_limit: {
    message: "A resource limit was reached.",
    retryable: false,
    action:
      "Review the effective limit and its recovery instructions before retrying.",
  },
  deadline_exceeded: {
    message: "The operation exceeded its deadline.",
    retryable: false,
    action:
      "Reduce the workload or adjust the reported timeout before retrying.",
  },
  cancelled: {
    message: "The operation was cancelled.",
    retryable: false,
    action: "Start a new operation when ready.",
  },
  cleanup_incomplete: {
    message: "Cleanup did not complete.",
    retryable: false,
    action:
      "Inspect the reported resources and complete cleanup before starting another operation.",
  },
  host_unsupported: {
    message: "This host is unsupported.",
    retryable: false,
    action: "Use a host listed in the supported platform matrix.",
  },
  integrity_violation: {
    message: "An integrity check failed.",
    retryable: false,
    action:
      "Stop using the affected artifact and investigate the integrity failure; do not disable the check.",
  },
  internal: {
    message: "An internal error occurred.",
    retryable: false,
    action:
      "Report the operation and available evidence IDs to the maintainer.",
  },
} as const;

export type AlaErrorCode = keyof typeof errorCatalog;
