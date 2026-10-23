const layerRule = (name, from, allowed) => ({
  name,
  severity: "error",
  from: { path: `^src/${from}/` },
  to: { path: "^src/", pathNot: `^src/(${allowed})/` },
});

module.exports = {
  forbidden: [
    layerRule("domain-boundary", "domain", "domain"),
    layerRule(
      "application-boundary",
      "application",
      "application|domain|store|providers/ports",
    ),
    layerRule("server-boundary", "server", "server|application|contracts"),
    layerRule("cli-boundary", "cli", "cli|application|contracts"),
    layerRule(
      "providers-boundary",
      "providers",
      "providers|process|sandbox|domain",
    ),
    layerRule("ports-boundary", "providers/ports", "providers/ports|domain"),
    {
      name: "application-ports-type-only",
      severity: "error",
      from: { path: "^src/application/" },
      to: {
        path: "^src/providers/ports/",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "domain-no-node-io",
      severity: "error",
      from: { path: "^src/domain/" },
      to: {
        path: "^(node:)?(fs|child_process|cluster|worker_threads|net|http|https|http2|dgram|dns|tls|readline|repl)(/|$)",
        dependencyTypes: ["core"],
      },
    },
    {
      name: "no-unresolved-imports",
      severity: "error",
      from: { path: "^src/" },
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "node", "default", "types"],
    },
  },
};
