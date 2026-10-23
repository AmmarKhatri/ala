import { spawn } from "node:child_process";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { limitRecoveryText } from "../config/limitRecoveryText.js";
import { parseEnvironmentOrThrow } from "../config/parseEnvironmentOrThrow.js";
import {
  AlaError,
  CancelledError,
  CleanupIncompleteError,
  DeadlineExceededError,
  HostUnsupportedError,
  InternalError,
  InvalidRequestError,
  ToolchainMissingError,
} from "../domain/errors/alaError.js";
import { CappedOutput } from "./cappedOutput.js";
import { processEnvironment } from "./processEnvironment.js";

export interface ProcessRequest {
  command: string;
  args?: readonly string[];
  cwd?: string;
  environment?: Readonly<Record<string, string | undefined>>;
  signal?: AbortSignal;
}

export interface ProcessResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  stderr: Buffer;
  output_truncated: { stdout: boolean; stderr: boolean };
  limits: { timeout: string; stdout: string; stderr: string };
}

export async function runProcess(
  request: ProcessRequest,
): Promise<ProcessResult> {
  if (process.platform === "win32") throw new HostUnsupportedError();
  if (!request.command || request.command.includes("\0"))
    throw new InvalidRequestError();
  if (request.signal?.aborted) throw new CancelledError();
  const environment = request.environment ?? process.env;
  const settings = parseEnvironmentOrThrow(environment);
  const timeout = settings.ALA_COMMAND_TIMEOUT_MS;
  const stdout = new CappedOutput(settings.ALA_PROCESS_STDOUT_MAX_BYTES.value);
  const stderr = new CappedOutput(settings.ALA_PROCESS_STDERR_MAX_BYTES.value);
  const privateRoot = await mkdtemp(join(tmpdir(), "ala-process-")).catch(
    () => {
      throw new InternalError({
        message: "The private process directory could not be created.",
      });
    },
  );
  let result: ProcessResult | undefined;
  let operationError: AlaError | undefined;
  try {
    await chmod(privateRoot, 0o700);
    result = await new Promise<ProcessResult>((resolve, reject) => {
      const child = spawn(request.command, [...(request.args ?? [])], {
        cwd: request.cwd ?? privateRoot,
        env: processEnvironment(environment, privateRoot),
        detached: true,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let failure: AlaError | undefined;
      const killTree = () => {
        if (child.pid === undefined) return;
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch (error) {
          if (
            !(
              error instanceof Error &&
              "code" in error &&
              error.code === "ESRCH"
            )
          ) {
            failure = new CleanupIncompleteError({
              details: { pid: child.pid },
            });
            child.kill("SIGKILL");
          }
        }
      };
      const cancel = () => {
        failure ??= new CancelledError();
        killTree();
      };
      const timer = setTimeout(() => {
        failure ??= new DeadlineExceededError({
          remediation: {
            action: limitRecoveryText(timeout),
            setting: timeout.definition.name,
            restart_required: false,
          },
          details: {
            effective_timeout_ms: timeout.value,
            source: timeout.source,
          },
        });
        killTree();
      }, timeout.value);
      request.signal?.addEventListener("abort", cancel, { once: true });
      if (request.signal?.aborted) cancel();
      child.stdout.on("data", (chunk: Buffer) => stdout.append(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderr.append(chunk));
      child.once("error", (error: NodeJS.ErrnoException) => {
        failure ??=
          error.code === "ENOENT"
            ? new ToolchainMissingError({
                message: "The executable or working directory was not found.",
              })
            : new InternalError({
                message: "The process could not be started.",
              });
      });
      // Descendants must not survive a successful parent either or hold our pipes open.
      child.once("exit", killTree);
      child.once("close", (exitCode, signal) => {
        clearTimeout(timer);
        request.signal?.removeEventListener("abort", cancel);
        if (failure) reject(failure);
        else
          resolve({
            exitCode,
            signal,
            stdout: stdout.bytes(),
            stderr: stderr.bytes(),
            limits: {
              timeout: limitRecoveryText(timeout),
              stdout: limitRecoveryText(settings.ALA_PROCESS_STDOUT_MAX_BYTES),
              stderr: limitRecoveryText(settings.ALA_PROCESS_STDERR_MAX_BYTES),
            },
            output_truncated: {
              stdout: stdout.truncated,
              stderr: stderr.truncated,
            },
          });
      });
    });
  } catch (error) {
    operationError =
      error instanceof AlaError
        ? error
        : new InternalError({
            message: "The process could not be prepared or started.",
          });
  }
  try {
    await rm(privateRoot, { recursive: true, force: true });
  } catch {
    throw new CleanupIncompleteError({
      details: {
        private_root: privateRoot,
        ...(operationError ? { operation_code: operationError.code } : {}),
      },
    });
  }
  if (operationError) throw operationError;
  if (!result) throw new InternalError();
  return result;
}
