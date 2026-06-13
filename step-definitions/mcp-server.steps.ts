import { Given, When, Then } from '@cucumber/cucumber';
import * as assert from 'assert';
import * as cp from 'child_process';
import { MpdsWorld } from '../support/world';
import { createProject } from '../modules/registry/index';
import { createSpec } from '../modules/components/index';

// ---------------------------------------------------------------------------
// Module augmentation — mirrors the one in support/mcp-server.hooks.ts
// Both files merge into the same MpdsWorld interface at compile time.
// ---------------------------------------------------------------------------
declare module '../support/world' {
  interface MpdsWorld {
    mcpPort: number;
    mcpServerProcess: cp.ChildProcess | null;
    lastStatus: number;
    serverError: boolean;
    mcpSecret: string;
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function baseUrl(world: MpdsWorld): string {
  const port = process.env.MCP_PORT;
  if (!port || world.serverError) {
    throw new Error(
      'MCP server did not start (modules/mcp-server/src/index.ts does not exist yet)'
    );
  }
  return `http://127.0.0.1:${port}`;
}

// Resolve 'test-secret' to the scenario-isolated secret.
// Prefers world.mcpSecret (set by both hook sets, no race) then falls back to
// process.env.MCP_SECRET for backward compatibility.
// Other token values (e.g. 'wrong-token') are used as-is for negative tests.
function resolveToken(world: MpdsWorld, token: string): string {
  if (token === 'test-secret') {
    const secret = world.mcpSecret || process.env.MCP_SECRET;
    if (!secret) throw new Error('mcpSecret not set — check mcp.hooks.ts or mcp-server.hooks.ts');
    return secret;
  }
  return token;
}

// ---------------------------------------------------------------------------
// Given — server lifecycle (resolved by Before hook; step just asserts hook ran)
// ---------------------------------------------------------------------------

Given(
  'the MCP server is running with secret {string}',
  async function (this: MpdsWorld, _secret: string) {
    // The Before hook in mcp-server.hooks.ts already started (or failed to start)
    // the server. If it failed, serverError is true; subsequent When steps will throw.
  }
);

// ---------------------------------------------------------------------------
// Given — data setup
// ---------------------------------------------------------------------------

Given(
  'a project {string} exists in the registry',
  async function (this: MpdsWorld, projectId: string) {
    await createProject({ id: projectId, name: projectId });
  }
);

Given(
  'a component {string} exists in project {string}',
  async function (this: MpdsWorld, componentId: string, projectId: string) {
    await createSpec({
      id: componentId,
      projectId,
      name: componentId,
    });
  }
);

// ---------------------------------------------------------------------------
// When — HTTP calls
// ---------------------------------------------------------------------------

When(
  'I GET {string} without auth',
  async function (this: MpdsWorld, urlPath: string) {
    const url = `${baseUrl(this)}${urlPath}`;
    const res = await fetch(url, { method: 'GET' });
    this.lastStatus = res.status;
    try {
      this.lastResult = await res.json();
    } catch {
      this.lastResult = null;
    }
  }
);

When(
  'I GET {string} with bearer token {string}',
  async function (this: MpdsWorld, urlPath: string, token: string) {
    const url = `${baseUrl(this)}${urlPath}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${resolveToken(this, token)}` },
    });
    this.lastStatus = res.status;
    try {
      this.lastResult = await res.json();
    } catch {
      this.lastResult = null;
    }
  }
);

When(
  'I POST {string} with bearer token {string} and body:',
  async function (this: MpdsWorld, urlPath: string, token: string, body: string) {
    const url = `${baseUrl(this)}${urlPath}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resolveToken(this, token)}`,
        'Content-Type': 'application/json',
      },
      body: body.trim(),
    });
    this.lastStatus = res.status;
    try {
      this.lastResult = await res.json();
    } catch {
      this.lastResult = null;
    }
  }
);

// ---------------------------------------------------------------------------
// Then — status assertion
// ---------------------------------------------------------------------------

Then(
  'the response status is {int}',
  function (this: MpdsWorld, expectedStatus: number) {
    assert.strictEqual(
      this.lastStatus,
      expectedStatus,
      `Expected HTTP ${expectedStatus} but got ${this.lastStatus}. Body: ${JSON.stringify(this.lastResult)}`
    );
  }
);

// ---------------------------------------------------------------------------
// Then — REST body assertions
// ---------------------------------------------------------------------------

Then(
  'the response body has {string} equal to {string}',
  function (this: MpdsWorld, key: string, expectedValue: string) {
    const body = this.lastResult as Record<string, unknown>;
    assert.ok(body !== null && typeof body === 'object', 'Response body is not an object');
    assert.strictEqual(
      String(body[key]),
      expectedValue,
      `Expected body.${key} to equal "${expectedValue}", got "${body[key]}"`
    );
  }
);

Then(
  'the response body is a JSON array',
  function (this: MpdsWorld) {
    assert.ok(
      Array.isArray(this.lastResult),
      `Expected a JSON array, got: ${JSON.stringify(this.lastResult)}`
    );
  }
);

Then(
  'the response error code is {string}',
  function (this: MpdsWorld, expectedCode: string) {
    const body = this.lastResult as Record<string, unknown>;
    assert.ok(body !== null && typeof body === 'object', 'Response body is not an object');
    const errorObj = body['error'] as Record<string, unknown> | undefined;
    assert.ok(
      errorObj !== null && typeof errorObj === 'object',
      `Expected body.error to be an object, got: ${JSON.stringify(body)}`
    );
    assert.strictEqual(
      (errorObj as Record<string, unknown>)['code'],
      expectedCode,
      `Expected error.code to be "${expectedCode}", got "${(errorObj as Record<string, unknown>)['code']}"`
    );
  }
);

// ---------------------------------------------------------------------------
// Then — MCP JSON-RPC assertions
// ---------------------------------------------------------------------------

Then(
  'the MCP result is an array',
  function (this: MpdsWorld) {
    const body = this.lastResult as Record<string, unknown>;
    assert.ok(body !== null && typeof body === 'object', 'MCP response is not an object');
    assert.ok(
      !Object.prototype.hasOwnProperty.call(body, 'error'),
      `MCP response contains an error: ${JSON.stringify(body['error'])}`
    );
    const result = body['result'];
    assert.ok(
      Array.isArray(result),
      `Expected MCP result to be an array, got: ${JSON.stringify(result)}`
    );
  }
);

Then(
  'the MCP response contains an error',
  function (this: MpdsWorld) {
    const body = this.lastResult as Record<string, unknown>;
    assert.ok(body !== null && typeof body === 'object', 'MCP response is not an object');
    assert.ok(
      Object.prototype.hasOwnProperty.call(body, 'error'),
      `Expected MCP response to contain an "error" field, got: ${JSON.stringify(body)}`
    );
  }
);

Then(
  'the MCP result has a {string} property',
  function (this: MpdsWorld, prop: string) {
    const body = this.lastResult as Record<string, unknown>;
    assert.ok(body !== null && typeof body === 'object', 'MCP response is not an object');
    assert.ok(
      !Object.prototype.hasOwnProperty.call(body, 'error'),
      `MCP response contains an error: ${JSON.stringify(body['error'])}`
    );
    const result = body['result'] as Record<string, unknown>;
    assert.ok(
      result !== null && typeof result === 'object' &&
        Object.prototype.hasOwnProperty.call(result, prop),
      `Expected MCP result to have property "${prop}", got: ${JSON.stringify(result)}`
    );
  }
);

Then(
  'the MCP result has an {string} property',
  function (this: MpdsWorld, prop: string) {
    const body = this.lastResult as Record<string, unknown>;
    assert.ok(body !== null && typeof body === 'object', 'MCP response is not an object');
    assert.ok(
      !Object.prototype.hasOwnProperty.call(body, 'error'),
      `MCP response contains an error: ${JSON.stringify(body['error'])}`
    );
    const result = body['result'] as Record<string, unknown>;
    assert.ok(
      result !== null && typeof result === 'object' &&
        Object.prototype.hasOwnProperty.call(result, prop),
      `Expected MCP result to have property "${prop}", got: ${JSON.stringify(result)}`
    );
  }
);
