import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const VSCODE_APP = "/Applications/Visual Studio Code.app";
const VSCODE_CLI = join(VSCODE_APP, "Contents/Resources/app/bin/code");
const manifest = JSON.parse(
  readFileSync(join(import.meta.dir, "../package.json"), "utf8"),
);
const EXTENSION_ID = `${manifest.publisher}.${manifest.name}`;
const LAUNCH_TIMEOUT_MS = 90_000;

const [vsixArgument, runDirArgument] = process.argv.slice(2);
if (!vsixArgument || !runDirArgument) {
  console.error(
    "Usage: bun scripts/verify-local-install.ts <path-to.vsix> <new-empty-run-directory>",
  );
  process.exit(2);
}

const vsixPath = resolve(vsixArgument);
const runDir = resolve(runDirArgument);
if (existsSync(runDir)) {
  console.error(`Run directory already exists; use a new one: ${runDir}`);
  process.exit(2);
}

const userDataDir = join(runDir, "user-data");
const extensionsDir = join(runDir, "extensions");
const resultPath = join(runDir, "probe-result.json");
const probeDir = join(import.meta.dir, "probe");
mkdirSync(join(userDataDir, "User"), { recursive: true });
mkdirSync(extensionsDir, { recursive: true });

writeFileSync(
  join(userDataDir, "User/settings.json"),
  JSON.stringify(
    {
      "telemetry.telemetryLevel": "off",
      "update.mode": "none",
      "extensions.autoUpdate": false,
      "extensions.autoCheckUpdates": false,
      "workbench.startupEditor": "none",
      "security.workspace.trust.enabled": false,
      "chat.mcp.autostart": "never",
      "chat.mcp.discovery.enabled": false,
      "chat.mcp.gallery.enabled": false,
    },
    null,
    2,
  ),
);

const isolationArgs = [
  "--user-data-dir",
  userDataDir,
  "--extensions-dir",
  extensionsDir,
];

function runCLI(args: string[]): string {
  const result = Bun.spawnSync([VSCODE_CLI, ...isolationArgs, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output =
    `${result.stdout.toString()}${result.stderr.toString()}`.trim();
  if (result.exitCode !== 0) {
    throw new Error(
      `code ${args.join(" ")} failed (${result.exitCode}): ${output}`,
    );
  }
  return output;
}

const installOutput = runCLI(["--install-extension", vsixPath]);
const listOutput = runCLI(["--list-extensions", "--show-versions"]);

const launch = Bun.spawn(
  [
    "open",
    "-g",
    "-j",
    "-n",
    "-W",
    "--env",
    `LINKBUNNY_PROBE_EXTENSION_ID=${EXTENSION_ID}`,
    "--env",
    `LINKBUNNY_PROBE_RESULT_PATH=${resultPath}`,
    "-a",
    VSCODE_APP,
    "--args",
    ...isolationArgs,
    "--skip-welcome",
    "--skip-release-notes",
    "--disable-workspace-trust",
    "--new-window",
    `--extensionDevelopmentPath=${probeDir}`,
    `--extensionTestsPath=${join(probeDir, "run.js")}`,
  ],
  { stdout: "pipe", stderr: "pipe" },
);
const deadline = Date.now() + LAUNCH_TIMEOUT_MS;
while (!existsSync(resultPath) && Date.now() < deadline) {
  await Bun.sleep(500);
}
// The throwaway instance ignores SIGTERM after the probe, so force-stop only processes using this run's profile.
const escapedUserDataDir = userDataDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
Bun.spawnSync([
  "pkill",
  "-KILL",
  "-f",
  `${escapedUserDataDir}(/|[[:space:]]|$)`,
]);
launch.kill();
const launchExitCode = await launch.exited;

const activationEvidence = Bun.spawnSync([
  "grep",
  "-rh",
  "onMcpCollection",
  join(userDataDir, "logs"),
])
  .stdout.toString()
  .trim();
const probe = existsSync(resultPath)
  ? JSON.parse(readFileSync(resultPath, "utf8"))
  : null;
const summary = {
  vsixPath,
  runDir,
  installOutput,
  listedExtensions: listOutput.split("\n"),
  launchExitCode,
  probe,
  activationEvidence,
};
writeFileSync(join(runDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

const passed =
  listOutput.includes(`${EXTENSION_ID}@`) &&
  probe?.installed === true &&
  probe?.activeAtProbeStart === false &&
  probe?.activatedAtStartupWithoutDiscovery === false &&
  probe?.activatedByMcpServerList === true;
process.exit(passed ? 0 : 1);
