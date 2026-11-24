# Release notes for maintainers

The extension ID on Visual Studio Marketplace and Open VSX is
`linkbunny.linkbunny-placement-checker`. The public source repository is
[hboon/linkbunny-placement-checker-vscode](https://github.com/hboon/linkbunny-placement-checker-vscode).
This maintainer guide isn't packaged into the VSIX.

## Build, test and package

```bash
pnpm i
bun run type-check
bun run test
bun run lint
bun run package <output>.vsix
bun run verify:install <output>.vsix <new-empty-run-directory>
```

`verify:install` uses the installed VS Code app with a throwaway
`--user-data-dir` and `--extensions-dir`. It launches VS Code in the background
with MCP autostart, discovery and gallery access disabled. It checks that the
VSIX installs, stays inactive at startup and activates through
`onMcpCollection:linkbunnyPlacementChecker` when the MCP server list opens.
Avoid `--log trace` because VS Code can record the resolved shell environment.

## Release acceptance

In a disposable profile on a VS Code build that includes the Copilot harness,
confirm the Checker appears in **MCP: List Servers**. Start a local Copilot
session, confirm the editor-provided Checker is available in that session, and
run `inspect_placement` once against one known public page. Use only the
extension-provided configuration. Record the exact package digest, the actual
tool event and its result with the selected harness. The installation
probe alone does not cover this path.

Record installation in an Open VSX fork separately if tested.

## Publication

Publish the exact accepted VSIX. Check the registered extension and version
on each destination before submitting. If a submission outcome is ambiguous,
check the current registry state before taking another action.

- [Visual Studio Marketplace](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
  uses GitHub Actions Trusted Publishing. Bind the policy to the public
  repository and release workflow, and use `vsce publish --oidc --packagePath`
  with the accepted VSIX.
- [Open VSX](https://github.com/eclipse-openvsx/openvsx/wiki/Trusted-Publishing)
  requires a signed Publisher Agreement, namespace ownership and an active
  extension version before Trusted Publishing can be registered. First
  publication requires a separately approved Open VSX access token. Use
  Trusted Publishing for later releases.
