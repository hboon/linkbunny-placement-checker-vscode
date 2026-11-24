import { beforeAll, describe, expect, mock, test } from "bun:test";

type Registration = {
  id: string;
  provider: { provideMcpServerDefinitions: () => unknown };
};

const registrations: Registration[] = [];

class McpHttpServerDefinition {
  constructor(
    readonly label: string,
    readonly uri: { toString: () => string },
    readonly headers?: Record<string, string>,
    readonly version?: string,
  ) {}
}

mock.module("vscode", () => ({
  lm: {
    registerMcpServerDefinitionProvider(
      id: string,
      provider: Registration["provider"],
    ) {
      registrations.push({ id, provider });
      return { dispose() {} };
    },
  },
  McpHttpServerDefinition,
  Uri: { parse: (value: string) => new URL(value) },
}));

const extension = await import("../src/extension.ts");

describe("activate", () => {
  const subscriptions: unknown[] = [];

  beforeAll(() => {
    extension.activate({ subscriptions } as never);
  });

  test("registers one provider that returns only the hosted checker over HTTP", async () => {
    expect(registrations).toHaveLength(1);
    expect(subscriptions).toHaveLength(1);
    const [registration] = registrations;
    expect(registration!.id).toBe(extension.PROVIDER_ID);

    const definitions =
      (await registration!.provider.provideMcpServerDefinitions()) as McpHttpServerDefinition[];
    expect(definitions).toHaveLength(1);
    const [definition] = definitions;
    expect(definition).toBeInstanceOf(McpHttpServerDefinition);
    expect(definition!.label).toBe("LinkBunny Placement Checker");
    expect(definition!.uri.toString()).toBe("https://mcp.getlinkbunny.com/mcp");
    expect(definition!.headers).toBeUndefined();
  });

  test("does not register a resolver that could prompt for credentials", () => {
    const provider = registrations[0]!.provider as Record<string, unknown>;
    expect(provider.resolveMcpServerDefinition).toBeUndefined();
    expect(provider.onDidChangeMcpServerDefinitions).toBeUndefined();
  });
});
