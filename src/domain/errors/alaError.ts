import { type AlaErrorCode, errorCatalog } from "./errorCatalog.js";

export interface ErrorContext {
  message?: string;
  remediation?: {
    action: string;
    setting?: string;
    restart_required?: boolean;
  };
  details?: Record<string, unknown>;
  evidence_ids?: string[];
}

export class AlaError extends Error {
  readonly code: AlaErrorCode;
  readonly retryable: boolean;
  readonly remediation: {
    action: string;
    setting?: string;
    restart_required?: boolean;
  };
  readonly details?: Record<string, unknown>;
  readonly evidence_ids?: string[];

  constructor(code: AlaErrorCode, context: ErrorContext = {}) {
    const definition = errorCatalog[code];
    super(context.message ?? definition.message);
    this.name = new.target.name;
    this.code = code;
    this.retryable = definition.retryable;
    this.remediation = context.remediation ?? { action: definition.action };
    this.details = context.details;
    this.evidence_ids = context.evidence_ids;
  }

  toPayload() {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      remediation: this.remediation,
      ...(this.details === undefined ? {} : { details: this.details }),
      ...(this.evidence_ids === undefined
        ? {}
        : { evidence_ids: this.evidence_ids }),
    };
  }
}

export class InvalidRequestError extends AlaError {
  constructor(context: ErrorContext = {}) {
    super("invalid_request", context);
  }
}

export class ConfigurationInvalidError extends AlaError {
  constructor(context: ErrorContext = {}) {
    super("configuration_invalid", context);
  }
}

export class NotFoundError extends AlaError {
  constructor(context: ErrorContext = {}) {
    super("not_found", context);
  }
}

export class IneligibleTargetError extends AlaError {
  constructor(context: ErrorContext = {}) {
    super("ineligible_target", context);
  }
}

export class SpecInvalidError extends AlaError {
  constructor(context: ErrorContext = {}) {
    super("spec_invalid", context);
  }
}

export class ToolchainMissingError extends AlaError {
  constructor(context: ErrorContext = {}) {
    super("toolchain_missing", context);
  }
}

export class SandboxUnavailableError extends AlaError {
  constructor(context: ErrorContext = {}) {
    super("sandbox_unavailable", context);
  }
}

export class ResourceLimitError extends AlaError {
  constructor(context: ErrorContext = {}) {
    super("resource_limit", context);
  }
}

export class DeadlineExceededError extends AlaError {
  constructor(context: ErrorContext = {}) {
    super("deadline_exceeded", context);
  }
}

export class CancelledError extends AlaError {
  constructor(context: ErrorContext = {}) {
    super("cancelled", context);
  }
}

export class CleanupIncompleteError extends AlaError {
  constructor(context: ErrorContext = {}) {
    super("cleanup_incomplete", context);
  }
}

export class HostUnsupportedError extends AlaError {
  constructor(context: ErrorContext = {}) {
    super("host_unsupported", context);
  }
}

export class IntegrityViolationError extends AlaError {
  constructor(context: ErrorContext = {}) {
    super("integrity_violation", context);
  }
}

export class InternalError extends AlaError {
  constructor(context: ErrorContext = {}) {
    super("internal", context);
  }
}
