import { Given, When, Then } from '@cucumber/cucumber';
import * as assert from 'assert';
import { MpdsWorld } from '../support/world';

function baseUrl(world: MpdsWorld): string {
  const port = world.mcpPort ? String(world.mcpPort) : process.env.MCP_PORT;
  if (!port || world.serverError) {
    throw new Error('MCP server did not start');
  }
  return `http://127.0.0.1:${port}`;
}

function resolveToken(world: MpdsWorld): string {
  if (!world.mcpSecret) throw new Error('mcpSecret not set');
  return world.mcpSecret;
}

async function mcpCall(world: MpdsWorld, method: string, params: unknown): Promise<void> {
  const url = `${baseUrl(world)}/mcp`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resolveToken(world)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  world.lastStatus = res.status;
  try {
    world.lastResult = await res.json();
  } catch {
    world.lastResult = null;
  }
}

// ---------------------------------------------------------------------------
// Given — proposal data setup
// ---------------------------------------------------------------------------

Given(
  'a token override proposal exists for project {string} key {string} value {string}',
  async function (this: MpdsWorld, projectId: string, key: string, value: string) {
    await mcpCall(this, 'propose_token_override', {
      projectId, key, value, rationale: 'test proposal',
    });
  }
);

// ---------------------------------------------------------------------------
// Then — proposals-specific assertions (no duplicates with mcp-server.steps.ts)
// ---------------------------------------------------------------------------

Then(
  'the MCP result has a {string} property equal to {string}',
  function (this: MpdsWorld, prop: string, expected: string) {
    const body = this.lastResult as Record<string, unknown>;
    const result = body['result'] as Record<string, unknown>;
    assert.strictEqual(
      result[prop],
      expected,
      `Expected result.${prop} = "${expected}", got "${result?.[prop]}"`
    );
  }
);

Then(
  'the proposals list contains a proposal with status {string}',
  function (this: MpdsWorld, status: string) {
    const body = this.lastResult as Record<string, unknown>;
    const results = (body['result'] as unknown[]) ?? [];
    const found = results.some(
      (r) => (r as Record<string, unknown>)['status'] === status
    );
    assert.ok(found, `Expected a proposal with status "${status}" in: ${JSON.stringify(results)}`);
  }
);

Then(
  'the token {string} still resolves to {string}',
  function (this: MpdsWorld, tokenKey: string, expected: string) {
    const body = this.lastResult as Record<string, unknown>;
    const tokens = (body['result'] as unknown[]) ?? [];
    const token = tokens.find(
      (t) => (t as Record<string, unknown>)['key'] === tokenKey
    ) as Record<string, unknown> | undefined;
    assert.ok(token !== undefined, `Token "${tokenKey}" not found in result`);
    assert.strictEqual(
      token['value'],
      expected,
      `Expected token "${tokenKey}" value = "${expected}", got "${token['value']}"`
    );
  }
);

Then(
  'the MCP error code is {string}',
  function (this: MpdsWorld, expectedCode: string) {
    const body = this.lastResult as Record<string, unknown>;
    const errorObj = body['error'] as Record<string, unknown> | undefined;
    assert.ok(
      errorObj !== null && typeof errorObj === 'object',
      `Expected body.error to be an object, got: ${JSON.stringify(body)}`
    );
    assert.strictEqual(
      errorObj!['code'],
      expectedCode,
      `Expected error.code "${expectedCode}", got "${errorObj!['code']}"`
    );
  }
);
