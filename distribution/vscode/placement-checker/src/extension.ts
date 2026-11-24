import * as vscode from "vscode";

export const PROVIDER_ID = "linkbunnyPlacementChecker";
export const SERVER_LABEL = "LinkBunny Placement Checker";
export const SERVER_URL = "https://mcp.getlinkbunny.com/mcp";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider(PROVIDER_ID, {
      provideMcpServerDefinitions() {
        return [
          new vscode.McpHttpServerDefinition(
            SERVER_LABEL,
            vscode.Uri.parse(SERVER_URL),
          ),
        ];
      },
    }),
  );
}

export function deactivate(): void {}
