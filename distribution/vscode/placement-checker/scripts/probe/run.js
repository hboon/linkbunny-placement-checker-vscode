const { writeFileSync } = require("node:fs");
const vscode = require("vscode");

const EXTENSION_ID = process.env.LINKBUNNY_PROBE_EXTENSION_ID;
const RESULT_PATH = process.env.LINKBUNNY_PROBE_RESULT_PATH;
const PASSIVE_WAIT_MS = 5_000;
const LIST_WAIT_MS = 20_000;

async function waitForActivation({ extension, waitMS }) {
  const deadline = Date.now() + waitMS;
  while (Date.now() < deadline) {
    if (extension.isActive) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return extension.isActive;
}

async function run() {
  const result = { vscodeVersion: vscode.version, extensionID: EXTENSION_ID };
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  result.installed = Boolean(extension);
  if (extension) {
    result.extensionPath = extension.extensionPath;
    result.contributedProviders =
      extension.packageJSON.contributes?.mcpServerDefinitionProviders ?? null;
    result.activeAtProbeStart = extension.isActive;
    result.activatedAtStartupWithoutDiscovery = await waitForActivation({
      extension,
      waitMS: PASSIVE_WAIT_MS,
    });
    // Opening the server list makes VS Code resolve extension MCP collections without starting a server.
    void vscode.commands.executeCommand("workbench.mcp.listServer");
    result.activatedByMcpServerList = await waitForActivation({
      extension,
      waitMS: LIST_WAIT_MS,
    });
  }
  writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2));
}

module.exports = { run };
