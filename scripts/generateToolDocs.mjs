import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { doctorContract } from "../dist/contracts/doctor.js";
import { pingContract } from "../dist/contracts/ping.js";

const contracts = [pingContract, doctorContract];
const sections = contracts.map((contract) => {
  const input = JSON.stringify(z.toJSONSchema(contract.input), null, 2);
  const output = JSON.stringify(z.toJSONSchema(contract.output), null, 2);
  return `## ${contract.name}\n\n${contract.description}\n\nInput schema:\n\n\`\`\`json\n${input}\n\`\`\`\n\nOutput schema:\n\n\`\`\`json\n${output}\n\`\`\`\n\nProject-derived content: ${contract.projectDerived ? "yes" : "no"}.\n`;
});
const text = `# MCP tools\n\nGenerated from src/contracts/ by npm run docs:generate. Do not edit manually.\n\n${sections.join("\n")}`;
const destination = new URL("../docs/tools.md", import.meta.url);
if (process.argv.includes("--check")) {
  const current = await readFile(destination, "utf8").catch(() => "");
  if (current !== text) {
    console.error("Tool docs are stale. Run npm run docs:generate.");
    process.exitCode = 1;
  } else {
    console.log("Tool docs match contracts.");
  }
} else {
  await writeFile(destination, text);
}
