#!/usr/bin/env node
import { readFile } from "node:fs/promises";

try {
  const { version } = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const [{ runCli }, { cliHandlers }] = await Promise.all([
    import("../dist/cli/runCli.js"),
    import("../dist/composition/cliHandlers.js"),
  ]);
  const result = await runCli(process.argv.slice(2), version, cliHandlers);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
} catch (error) {
  const missingBuild =
    error instanceof Error &&
    "code" in error &&
    error.code === "ERR_MODULE_NOT_FOUND" &&
    "url" in error &&
    typeof error.url === "string" &&
    error.url.startsWith(new URL("../dist/", import.meta.url).href);
  process.stderr.write(
    missingBuild
      ? "ALA build files are missing. Run npm run build in the ALA checkout and retry.\n"
      : "ALA could not start. Check the installation and retry.\n",
  );
  process.exitCode = 1;
}
