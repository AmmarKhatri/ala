import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const files = existsSync("src")
  ? readdirSync("src", { recursive: true }).filter((file) =>
      /\.[cm]?[jt]sx?$/.test(file),
    )
  : [];

// Foundation tasks precede runtime code; once source exists it must be checked.
if (files.length === 0) {
  console.log("Architecture: no source files yet.");
} else {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL(
          "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs",
          root,
        ),
      ),
      "--config",
      fileURLToPath(new URL(".dependency-cruiser.cjs", root)),
      "--output-type",
      "json",
      "src",
    ],
    { encoding: "utf8" },
  );
  if (result.error) console.error(result.error.message);
  if (result.stderr) process.stderr.write(result.stderr);
  if (!result.stdout) {
    process.exitCode = result.status || 1;
  } else {
    const report = JSON.parse(result.stdout);
    const analyzed = new Set(report.modules.map((module) => module.source));
    const skipped = files.filter(
      (file) => !/\.d\.[cm]?ts$/.test(file) && !analyzed.has(`src/${file}`),
    );
    if (skipped.length > 0) {
      console.error(
        `Architecture: source files were not analyzed: ${skipped.join(", ")}. Check dependency-cruiser parser support and installed TypeScript version.`,
      );
      process.exitCode = 1;
    }
    for (const violation of report.summary.violations) {
      if (violation.rule.severity === "error") process.exitCode = 1;
      console.error(
        `${violation.rule.severity} ${violation.rule.name}: ${violation.from} -> ${violation.to}`,
      );
    }
    if (result.status !== 0) process.exitCode = result.status ?? 1;
    if (!process.exitCode)
      console.log("Architecture: no dependency violations found.");
  }
}
