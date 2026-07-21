export function getPluginManifest() {
  return {
    name: "ccmm",
    version: "0.1.5",
    description: "Claude Code Model Manager",
    statusLine: { type: "command", command: "ccmm statusline" },
    mcpServers: { ccmm: { command: "node", args: [process.argv[1], "mcp"] } },
  };
}