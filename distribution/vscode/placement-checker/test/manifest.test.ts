import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const packageDir = join(import.meta.dir, "..");
const repoRoot = join(packageDir, "../../..");
const manifest = JSON.parse(
  readFileSync(join(packageDir, "package.json"), "utf8"),
);
const source = readFileSync(join(packageDir, "src/extension.ts"), "utf8");
const readme = readFileSync(join(packageDir, "README.md"), "utf8");
const changelog = readFileSync(join(packageDir, "CHANGELOG.md"), "utf8");

describe("manifest", () => {
  test("contributes exactly the provider ID the source registers", () => {
    expect(manifest.contributes.mcpServerDefinitionProviders).toEqual([
      { id: "linkbunnyPlacementChecker", label: "LinkBunny Placement Checker" },
    ]);
    expect(source).toContain(`PROVIDER_ID = "linkbunnyPlacementChecker"`);
  });

  test("uses the same hosted checker URL as the other checker packages", () => {
    const cursorConfig = JSON.parse(
      readFileSync(
        join(repoRoot, "distribution/cursor/placement-checker/mcp.json"),
        "utf8",
      ),
    );
    const cursorURL =
      cursorConfig.mcpServers["linkbunny-placement-checker"].url;
    expect(cursorURL).toBe("https://mcp.getlinkbunny.com/mcp");
    expect(source).toContain(`SERVER_URL = "${cursorURL}"`);
  });

  test("keeps the engine floor at the first stable MCP provider API and matching types", () => {
    expect(manifest.engines.vscode).toBe("^1.101.0");
    expect(manifest.devDependencies["@types/vscode"]).toBe("1.101.0");
  });

  test("activates only through implicit MCP collection discovery", () => {
    expect(manifest.activationEvents).toEqual([]);
  });

  test("exposes no settings, commands or other contribution that could change the endpoint", () => {
    expect(Object.keys(manifest.contributes)).toEqual([
      "mcpServerDefinitionProviders",
    ]);
    expect(manifest.dependencies).toBeUndefined();
  });

  test("uses the release publisher and public source repository", () => {
    expect(manifest.publisher).toBe("linkbunny");
    expect(manifest.repository).toEqual({
      type: "git",
      url: "https://github.com/hboon/linkbunny-placement-checker-vscode.git",
    });
  });

  test("uses a PNG icon, as the Marketplace rejects SVG icons", () => {
    expect(manifest.icon).toMatch(/\.png$/);
  });
});

describe("package contents", () => {
  test("packages only the listing files and the compiled extension", () => {
    const result = Bun.spawnSync(
      ["pnpm", "exec", "vsce", "ls", "--no-dependencies"],
      {
        cwd: packageDir,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(result.exitCode).toBe(0);
    const files = result.stdout.toString().trim().split("\n").sort();
    expect(files).toEqual([
      "CHANGELOG.md",
      "LICENSE",
      "README.md",
      "assets/logo.png",
      "dist/extension.js",
      "package.json",
    ]);
  });
});

describe("source safety", () => {
  test("makes no network requests and reads no secrets or configuration", () => {
    for (const forbidden of [
      "fetch(",
      "require(",
      "http",
      "secrets",
      "getConfiguration",
      "authentication",
      "telemetry",
      "env.",
    ]) {
      const withoutURL = source.replace(
        `"https://mcp.getlinkbunny.com/mcp"`,
        "",
      );
      expect(withoutURL).not.toContain(forbidden);
    }
  });

  test("imports only the vscode API", () => {
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(imports).toEqual(["vscode"]);
  });
});

describe("public copy", () => {
  test("avoids phrases the project bans from public copy", () => {
    const banned = [
      "owner-authorized",
      "typed tools",
      "existing LinkBunny HTTPS API",
      "data for review",
      "permission to change a site",
      "material URL changes",
      "owner authorization",
      "specific authorization",
      "owner-managed site",
    ];
    for (const text of [
      readme,
      changelog,
      manifest.description,
      manifest.displayName,
    ]) {
      for (const phrase of banned) {
        expect(text.toLowerCase()).not.toContain(phrase.toLowerCase());
      }
    }
  });

  test("never mentions the placeholder publisher in the listing", () => {
    expect(readme).not.toContain("placeholder");
    expect(changelog).not.toContain("placeholder");
  });
});
