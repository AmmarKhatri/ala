export const PROCESS_ENV_ALLOWLIST = [
  "PATH",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TZ",
  "CC",
  "CXX",
  "AR",
  "RANLIB",
  "RUSTC",
  "CARGO",
  "ZIG",
] as const;

export function processEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
  privateRoot: string,
): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const name of PROCESS_ENV_ALLOWLIST) {
    const value = environment[name];
    if (value !== undefined) clean[name] = value;
  }
  // HOME and temporary locations never point at the caller's credentials or caches.
  return {
    ...clean,
    HOME: privateRoot,
    TMPDIR: privateRoot,
    TMP: privateRoot,
    TEMP: privateRoot,
  };
}
