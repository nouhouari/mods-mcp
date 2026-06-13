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

function resolveToken(world: MpdsWorld, token: string): string {
  if (token === 'test-secret') {
    if (!world.mcpSecret) throw new Error('mcpSecret not set');
    return world.mcpSecret;
  }
  return token;
}

async function mcpCall(world: MpdsWorld, method: string, params: unknown): Promise<void> {
  const url = `${baseUrl(world)}/mcp`;
  const secret = resolveToken(world, 'test-secret');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
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
// Given — guideline data setup
// ---------------------------------------------------------------------------

Given(
  'a guideline {string} with title {string} and body {string}',
  async function (this: MpdsWorld, id: string, title: string, body: string) {
    const url = `${baseUrl(this)}/mcp`;
    const secret = resolveToken(this, 'test-secret');
    await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 99, method: 'create_guideline',
        params: { id, title, body, tags: [] },
      }),
    });
  }
);

// ---------------------------------------------------------------------------
// When — MCP method call with inline JSON params
// ---------------------------------------------------------------------------

When(
  'I call the MCP method {string} with params {string}',
  async function (this: MpdsWorld, method: string, paramsJson: string) {
    const params = JSON.parse(paramsJson) as unknown;
    await mcpCall(this, method, params);
  }
);

// ---------------------------------------------------------------------------
// Then — assertions for search_guidelines
// ---------------------------------------------------------------------------

Then(
  'the first result has a {string} property between {int} and {int}',
  function (this: MpdsWorld, prop: string, min: number, max: number) {
    const body = this.lastResult as Record<string, unknown>;
    const results = (body['result'] as unknown[]) ?? [];
    assert.ok(results.length > 0, 'Expected at least one result');
    const first = results[0] as Record<string, unknown>;
    const val = first[prop] as number;
    assert.ok(
      typeof val === 'number' && val >= min && val <= max,
      `Expected ${prop} between ${min} and ${max}, got ${val}`
    );
  }
);

Then(
  'each result has {string}, {string}, {string}, {string}, {string} fields',
  function (this: MpdsWorld, f1: string, f2: string, f3: string, f4: string, f5: string) {
    const body = this.lastResult as Record<string, unknown>;
    const results = (body['result'] as unknown[]) ?? [];
    for (const item of results) {
      const r = item as Record<string, unknown>;
      for (const field of [f1, f2, f3, f4, f5]) {
        assert.ok(
          Object.prototype.hasOwnProperty.call(r, field),
          `Result missing field "${field}": ${JSON.stringify(r)}`
        );
      }
    }
  }
);

Then(
  'the first result bodyExcerpt length is at most {int}',
  function (this: MpdsWorld, maxLen: number) {
    const body = this.lastResult as Record<string, unknown>;
    const results = (body['result'] as unknown[]) ?? [];
    assert.ok(results.length > 0, 'Expected at least one result');
    const first = results[0] as Record<string, unknown>;
    const excerpt = first['bodyExcerpt'] as string;
    assert.ok(
      typeof excerpt === 'string' && excerpt.length <= maxLen,
      `Expected bodyExcerpt length <= ${maxLen}, got ${excerpt?.length}`
    );
  }
);

Then(
  'the MCP response does not contain an error',
  function (this: MpdsWorld) {
    const body = this.lastResult as Record<string, unknown>;
    assert.ok(body !== null && typeof body === 'object', 'Response is not an object');
    assert.ok(
      !Object.prototype.hasOwnProperty.call(body, 'error') ||
        body['error'] === null || body['error'] === undefined,
      `Expected no error in MCP response, got: ${JSON.stringify(body['error'])}`
    );
  }
);
