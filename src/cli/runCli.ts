export interface CliResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

export interface CliHandlers {
  mcp(options: { transport: "stdio" | "http" }): Promise<CliResult>;
  doctor(): Promise<CliResult>;
}

const help = `Usage: ala <command>

Commands:
  mcp          Start the MCP server over stdio
  mcp --http   Start the MCP server over HTTP
  doctor       Inspect environment readiness

Options:
  --version    Print the installed version
  --help, -h   Show this help
`;

export async function runCli(
  args: readonly string[],
  version: string,
  handlers: CliHandlers,
): Promise<CliResult> {
  const [command, ...options] = args;
  if (
    args.length === 0 ||
    (args.length === 1 && (command === "--help" || command === "-h")) ||
    (args.length === 2 &&
      (command === "mcp" || command === "doctor") &&
      (options[0] === "--help" || options[0] === "-h"))
  ) {
    return { exitCode: 0, stdout: help };
  }
  if (args.length === 1 && command === "--version") {
    return { exitCode: 0, stdout: `${version}\n` };
  }
  if (command === "mcp" && options.length === 0) {
    return handlers.mcp({ transport: "stdio" });
  }
  if (command === "mcp" && options.length === 1 && options[0] === "--http") {
    return handlers.mcp({ transport: "http" });
  }
  if (command === "doctor" && options.length === 0) {
    return handlers.doctor();
  }
  return { exitCode: 2, stderr: `Unknown command or options.\n\n${help}` };
}
