/**
 * MCP Write Methods — Step Definitions
 *
 * Covers P3 MCP write tool scenarios:
 *   @US-P3-001 — project management (create_project, update_project, delete_project)
 *   @US-P3-002 — token management (create_token, list_tokens, get_token, set_token, delete_token)
 *   @US-P3-003 — component management (create_component, update_component, delete_component)
 *   @US-P3-004 — pattern library (create_pattern, update_pattern, delete_pattern,
 *                                  create_variant, create_composition_rule, create_layout_guideline)
 *
 * Design decisions:
 * - All MCP calls go through the shared `mcpPost` helper (POST /mcp, JSON-RPC 2.0).
 * - `this.lastResult`  = raw parsed JSON body ({ jsonrpc, id, result|error })
 * - `this.lastStatus`  = HTTP status code (always 200 for MCP; asserted as-is)
 * - `this.lastResponse` is NOT used here; result is read from `this.lastResult.result`.
 * - Version captured from get_token / get_component_spec is stored on `this.storedVersion`
 *   so subsequent set_token / update_component steps can use it without Gherkin repetition.
 * - "I call the MCP write method ... with JSON params:" steps do NOT duplicate the
 *   "I call the MCP method ... with params ..." step from mcp-guidelines.steps.ts —
 *   the step text is different: "write method" vs "method", and a docstring vs inline JSON.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import * as assert from 'assert';
import { MpdsWorld } from '../support/world';

// ---------------------------------------------------------------------------
// Module augmentation — add P3-specific world properties
// ---------------------------------------------------------------------------

declare module '../support/world' {
  interface MpdsWorld {
    /** Captured version integer from get_token / get_component_spec for OCC steps */
    storedVersion: number | null;
    /** Last captured MCP pattern id for chained variant/rule steps */
    mcpLastPatternId: string | null;
    /** Last captured MCP component id for chained update steps */
    mcpLastComponentId: string | null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseUrl(world: MpdsWorld): string {
  const port = world.mcpPort ? String(world.mcpPort) : process.env.MCP_PORT;
  if (!port || world.serverError) {
    throw new Error('MCP server did not start — check mcp.hooks.ts');
  }
  return `http://127.0.0.1:${port}`;
}

function secret(world: MpdsWorld): string {
  const s = world.mcpSecret || process.env.MCP_SECRET;
  if (!s) throw new Error('mcpSecret not set on world — check mcp.hooks.ts');
  return s;
}

/** POST /mcp with a JSON-RPC 2.0 envelope. Stores HTTP status and raw body. */
async function mcpPost(
  world: MpdsWorld,
  method: string,
  params: Record<string, unknown>
): Promise<void> {
  const url = `${baseUrl(world)}/mcp`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret(world)}`,
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

/** Return result object from the last MCP response or throw if it is an error. */
function getResult(world: MpdsWorld): Record<string, unknown> {
  const body = world.lastResult as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    throw new Error(`Expected JSON-RPC body, got: ${JSON.stringify(body)}`);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'error')) {
    throw new Error(`MCP returned error: ${JSON.stringify(body['error'])}`);
  }
  return body['result'] as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Given — data-setup steps (project, token, component, pattern via MCP)
// ---------------------------------------------------------------------------

/**
 * Create a project and store its id on world for later reference.
 * Unlike the direct-DB step in mcp-server.steps.ts, this goes through MCP
 * so it exercises the full write path.
 *
 * Intentionally kept separate from "a project {string} exists in the registry"
 * (which writes directly to the DB) — these Given steps use MCP itself.
 */
Given(
  'a MCP token {string} with category {string} and value {string} in project {string}',
  async function (this: MpdsWorld, key: string, category: string, value: string, projectId: string) {
    await mcpPost(this, 'create_token', { projectId, key, category, value });
    const result = getResult(this);
    // Store version from the newly created token (version starts at 0)
    this.storedVersion = typeof result['version'] === 'number' ? result['version'] : 0;
  }
);

Given(
  'a MCP component {string} named {string} in project {string}',
  async function (this: MpdsWorld, componentId: string, name: string, projectId: string) {
    await mcpPost(this, 'create_component', { projectId, id: componentId, name });
    const result = getResult(this);
    this.mcpLastComponentId = componentId;
    this.storedVersion = typeof result['version'] === 'number' ? result['version'] : 0;
  }
);

Given(
  'a MCP pattern {string} named {string} in project {string}',
  async function (this: MpdsWorld, patternId: string, name: string, projectId: string) {
    await mcpPost(this, 'create_pattern', {
      projectId,
      id: patternId,
      name,
      category: 'component',
      description: `${name} test pattern`,
    });
    getResult(this); // assert no error
    this.mcpLastPatternId = patternId;
  }
);

// ---------------------------------------------------------------------------
// When — generic MCP write call with docstring JSON params
// ---------------------------------------------------------------------------

/**
 * "I call the MCP write method {string} with JSON params:"
 *
 * Distinct from the inline-string step in mcp-guidelines.steps.ts
 * ("I call the MCP method {string} with params {string}") — that one takes
 * a quoted inline string; this one uses a Gherkin docstring, which is
 * a better fit for multi-field JSON objects in feature files.
 */
When(
  'I call the MCP write method {string} with JSON params:',
  async function (this: MpdsWorld, method: string, paramsJson: string) {
    const params = JSON.parse(paramsJson.trim()) as Record<string, unknown>;
    await mcpPost(this, method, params);
  }
);

// ---------------------------------------------------------------------------
// When — OCC-aware steps (version captured from prior get_token / get_component_spec)
// ---------------------------------------------------------------------------

/**
 * Uses the version stored on world.storedVersion from a preceding get_token call.
 * Maps to the MCP `update_token` method (for base / non-child projects).
 *
 * Note: `set_token` calls setOverride and requires the project to have a parentId.
 * For base projects, `update_token` is the correct OCC update path.
 */
When(
  'I call the MCP write method "update_token" with the stored version for project {string} key {string} and value {string}',
  async function (this: MpdsWorld, projectId: string, key: string, value: string) {
    const body = this.lastResult as Record<string, unknown> | null;
    const result = body?.['result'] as Record<string, unknown> | undefined;
    const version = typeof result?.['version'] === 'number'
      ? result['version']
      : (this.storedVersion ?? 0);
    await mcpPost(this, 'update_token', { projectId, key, version, value });
  }
);

/**
 * Uses the version from the last get_token call (in lastResult.result.version)
 * to call delete_token with optimistic concurrency control.
 */
When(
  'I call the MCP write method "delete_token" with the stored version for project {string} key {string}',
  async function (this: MpdsWorld, projectId: string, key: string) {
    const body = this.lastResult as Record<string, unknown> | null;
    const result = body?.['result'] as Record<string, unknown> | undefined;
    const version = typeof result?.['version'] === 'number'
      ? result['version']
      : (this.storedVersion ?? 0);
    await mcpPost(this, 'delete_token', { projectId, key, version });
  }
);

/**
 * Fetches the component spec via get_component_spec MCP method to capture the
 * current version, then stores it on world.storedVersion for the update step.
 * The awkward step text mirrors the Gherkin step in the feature file verbatim.
 */
When(
  'I call the MCP write method "get_component_spec_raw" via mcp for project {string} component {string}',
  async function (this: MpdsWorld, projectId: string, componentId: string) {
    await mcpPost(this, 'get_component_spec', { projectId, componentId });
    const result = getResult(this);
    this.storedVersion = typeof result['version'] === 'number' ? result['version'] : 0;
    this.mcpLastComponentId = componentId;
  }
);

/**
 * Uses the version captured by "get_component_spec_raw" to call update_component
 * with an optimistic-concurrency version check.
 */
When(
  'I call the MCP write method "update_component" with the stored component version for project {string} component {string} and description {string}',
  async function (
    this: MpdsWorld,
    projectId: string,
    componentId: string,
    description: string
  ) {
    const version = this.storedVersion ?? 0;
    await mcpPost(this, 'update_component', { projectId, componentId, version, description });
  }
);

// ---------------------------------------------------------------------------
// Then — MCP result assertions
// ---------------------------------------------------------------------------

/**
 * Assert that result.<field> equals <value> (string comparison).
 * Works for string, number and boolean fields (value is compared as string).
 */
Then(
  'the MCP result field {string} equals {string}',
  function (this: MpdsWorld, field: string, expected: string) {
    const body = this.lastResult as Record<string, unknown> | null;
    assert.ok(body && typeof body === 'object', `MCP response is not an object: ${JSON.stringify(body)}`);
    assert.ok(
      !Object.prototype.hasOwnProperty.call(body, 'error'),
      `MCP response contains error: ${JSON.stringify(body['error'])}`
    );
    const result = body['result'] as Record<string, unknown>;
    assert.ok(
      result && typeof result === 'object',
      `MCP result is not an object: ${JSON.stringify(result)}`
    );
    assert.strictEqual(
      String(result[field]),
      expected,
      `Expected result.${field} = "${expected}", got "${result[field]}". Full result: ${JSON.stringify(result)}`
    );
  }
);

/**
 * Assert that result.success === true.
 */
Then(
  'the MCP result has success true',
  function (this: MpdsWorld) {
    const body = this.lastResult as Record<string, unknown> | null;
    assert.ok(body && typeof body === 'object', `MCP response is not an object: ${JSON.stringify(body)}`);
    assert.ok(
      !Object.prototype.hasOwnProperty.call(body, 'error'),
      `MCP response contains error: ${JSON.stringify(body['error'])}`
    );
    const result = body['result'] as Record<string, unknown>;
    assert.strictEqual(
      result['success'],
      true,
      `Expected result.success = true, got "${result['success']}". Full result: ${JSON.stringify(result)}`
    );
  }
);

/**
 * Assert that error.code contains the given substring.
 * Uses include() rather than strict equality so callers can match partial codes
 * (e.g. "DUPLICATE" matches "DUPLICATE_PROJECT_ID" or "DUPLICATE_COMPONENT_ID").
 */
Then(
  'the MCP error code should include {string}',
  function (this: MpdsWorld, fragment: string) {
    const body = this.lastResult as Record<string, unknown> | null;
    assert.ok(body && typeof body === 'object', `MCP response is not an object: ${JSON.stringify(body)}`);
    assert.ok(
      Object.prototype.hasOwnProperty.call(body, 'error'),
      `Expected an error in MCP response, got: ${JSON.stringify(body)}`
    );
    const errorObj = body['error'] as Record<string, unknown>;
    const code = String(errorObj['code'] ?? '');
    assert.ok(
      code.includes(fragment),
      `Expected error.code to include "${fragment}", got "${code}". Full error: ${JSON.stringify(errorObj)}`
    );
  }
);
