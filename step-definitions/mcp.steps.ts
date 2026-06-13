import { Given, When, Then } from '@cucumber/cucumber';
import * as assert from 'assert';
import { MpdsWorld } from '../support/world';
import { createToken } from '../modules/tokens/index';

function baseUrl(world: MpdsWorld): string {
  const port = process.env.MCP_PORT;
  if (!port || world.serverError) {
    throw new Error('MCP server did not start');
  }
  return `http://127.0.0.1:${port}`;
}

// ---------------------------------------------------------------------------
// Given — data setup (new steps only; server/project/component steps are in
// mcp-server.steps.ts and shared across all scenarios)
// ---------------------------------------------------------------------------

Given(
  'token {string} with value {string} and category {string} exists in project {string}',
  async function (this: MpdsWorld, key: string, value: string, category: string, projectId: string) {
    await createToken({ projectId, key, category, value });
  }
);

// ---------------------------------------------------------------------------
// When — HTTP calls (new steps only; GET/POST-with-docstring already exist in
// mcp-server.steps.ts)
// ---------------------------------------------------------------------------

When(
  'I POST {string} without auth with body {string}',
  async function (this: MpdsWorld, urlPath: string, body: string) {
    const url = `${baseUrl(this)}${urlPath}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

When(
  'I POST {string} with Authorization header {string} and body {string}',
  async function (this: MpdsWorld, urlPath: string, authHeader: string, body: string) {
    const url = `${baseUrl(this)}${urlPath}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
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

When(
  'I DELETE {string} with bearer token {string}',
  async function (this: MpdsWorld, urlPath: string, token: string) {
    const url = `${baseUrl(this)}${urlPath}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
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
// Then — assertions (new steps only)
// ---------------------------------------------------------------------------

Then(
  'the contrast result passes',
  function (this: MpdsWorld) {
    const body = this.lastResult as Record<string, unknown>;
    assert.ok(body !== null && typeof body === 'object', 'Response body is not an object');
    // Works for both MCP /mcp (result.passes) and REST /api/validate (passes at root)
    const passes =
      (body['result'] as Record<string, unknown> | undefined)?.['passes'] ??
      body['passes'];
    assert.strictEqual(passes, true, `Expected passes=true, got: ${JSON.stringify(body)}`);
  }
);

Then(
  'the contrast result fails',
  function (this: MpdsWorld) {
    const body = this.lastResult as Record<string, unknown>;
    assert.ok(body !== null && typeof body === 'object', 'Response body is not an object');
    const passes =
      (body['result'] as Record<string, unknown> | undefined)?.['passes'] ??
      body['passes'];
    assert.strictEqual(passes, false, `Expected passes=false, got: ${JSON.stringify(body)}`);
  }
);

Then(
  'the response body has {string} equal to float {float}',
  function (this: MpdsWorld, keyPath: string, expectedValue: number) {
    const body = this.lastResult as Record<string, unknown>;
    assert.ok(body !== null && typeof body === 'object', 'Response body is not an object');
    // Support dot-path like "result.ratio" or "ratio"
    const parts = keyPath.split('.');
    let val: unknown = body;
    for (const part of parts) {
      val = (val as Record<string, unknown>)[part];
    }
    const numVal = typeof val === 'number' ? val : parseFloat(String(val));
    assert.ok(
      Math.abs(numVal - expectedValue) <= 0.02,
      `Expected ${keyPath}=${expectedValue} (±0.02), got ${numVal}`
    );
  }
);

// ---------------------------------------------------------------------------
// @US-060 step definitions
// ---------------------------------------------------------------------------

Given(
  'a token {string} of category {string} with value {string} exists in {string}',
  async function (this: MpdsWorld, key: string, category: string, value: string, projectId: string) {
    await createToken({ projectId, key, category, value });
  }
);

When(
  'I PUT {string} with bearer token {string} and body:',
  async function (this: MpdsWorld, urlPath: string, token: string, body: string) {
    const url = `${baseUrl(this)}${urlPath}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
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

Then(
  'the response body has error code {string}',
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

Then(
  'the response body does not contain {string}',
  function (this: MpdsWorld, forbidden: string) {
    const raw = JSON.stringify(this.lastResult);
    assert.ok(
      !raw.includes(forbidden),
      `Expected response body not to contain "${forbidden}", but found it in: ${raw}`
    );
  }
);
