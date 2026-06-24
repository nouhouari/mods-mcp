/**
 * MCP Showcase — Step Definitions
 *
 * Covers @US-P4-001 generate_showcase scenarios in features/api/mcp-showcase.feature.
 *
 * These are the ONLY three new steps added here.  Every other step reused by
 * mcp-showcase.feature already exists in:
 *   - mcp-server.steps.ts  : "the MCP server is running with secret {string}",
 *                            "a project {string} exists in the registry",
 *                            "the response status is {int}"
 *   - patterns.steps.ts    : "the database is empty"
 *   - mcp-write.steps.ts   : "a MCP token {string} with category {string} and value {string} in project {string}",
 *                            "a MCP component {string} named {string} in project {string}",
 *                            "I call the MCP write method {string} with JSON params:",
 *                            "the MCP error code should include {string}"
 *
 * New steps introduced here (intentionally minimal):
 *   1. Then the MCP result field {string} should be a non-empty string
 *   2. Then the MCP result field {string} should be {int}
 *   3. Then the MCP result HTML should contain {string}
 */

import { Then } from '@cucumber/cucumber';
import * as assert from 'assert';
import { MpdsWorld } from '../support/world';

// ---------------------------------------------------------------------------
// Internal helper — extract result object from JSON-RPC response
// ---------------------------------------------------------------------------

function extractResult(world: MpdsWorld): Record<string, unknown> {
  const body = world.lastResult as Record<string, unknown> | null;
  assert.ok(
    body !== null && typeof body === 'object',
    `Expected a JSON-RPC response object, got: ${JSON.stringify(body)}`
  );
  assert.ok(
    !Object.prototype.hasOwnProperty.call(body, 'error'),
    `MCP response contains an error: ${JSON.stringify(body['error'])}`
  );
  const result = body['result'] as Record<string, unknown>;
  assert.ok(
    result !== null && typeof result === 'object',
    `MCP result is not an object: ${JSON.stringify(result)}`
  );
  return result;
}

// ---------------------------------------------------------------------------
// Then — field is a non-empty string
// ---------------------------------------------------------------------------

/**
 * Assert that result.<field> is a string with length > 0.
 * Used for the "html" field of generate_showcase, which must be a populated
 * HTML document regardless of whether the project has data.
 */
Then(
  'the MCP result field {string} should be a non-empty string',
  function (this: MpdsWorld, field: string) {
    const result = extractResult(this);
    const value = result[field];
    assert.strictEqual(
      typeof value,
      'string',
      `Expected result.${field} to be a string, got ${typeof value}: ${JSON.stringify(value)}`
    );
    assert.ok(
      (value as string).length > 0,
      `Expected result.${field} to be non-empty, but it was an empty string`
    );
  }
);

// ---------------------------------------------------------------------------
// Then — field equals an integer
// ---------------------------------------------------------------------------

/**
 * Assert that result.<field> equals the given integer.
 * Used for tokenCount, componentCount, patternCount in generate_showcase.
 *
 * Note: Cucumber's {int} parameter type coerces to a JavaScript number,
 * so strict equality (===) works for whole-number counts.
 */
Then(
  'the MCP result field {string} should be {int}',
  function (this: MpdsWorld, field: string, expected: number) {
    const result = extractResult(this);
    const actual = result[field];
    assert.strictEqual(
      actual,
      expected,
      `Expected result.${field} = ${expected}, got ${JSON.stringify(actual)}. Full result: ${JSON.stringify(result)}`
    );
  }
);

// ---------------------------------------------------------------------------
// Then — HTML output contains a substring
// ---------------------------------------------------------------------------

/**
 * Assert that result.html (the generated showcase document) includes the
 * given substring.  Covers both CSS custom property names and token values.
 */
Then(
  'the MCP result HTML should contain {string}',
  function (this: MpdsWorld, substring: string) {
    const result = extractResult(this);
    const html = result['html'];
    assert.strictEqual(
      typeof html,
      'string',
      `Expected result.html to be a string, got ${typeof html}: ${JSON.stringify(html)}`
    );
    assert.ok(
      (html as string).includes(substring),
      `Expected result.html to contain "${substring}".\nActual HTML (first 500 chars): ${(html as string).slice(0, 500)}`
    );
  }
);

// ---------------------------------------------------------------------------
// Then — result is a raw HTML document (format:"html")
// ---------------------------------------------------------------------------

/**
 * Assert that the JSON-RPC result IS the raw HTML string itself (not a wrapper
 * object). Used for generate_showcase with format:"html".
 */
Then(
  'the MCP result should be a raw HTML document',
  function (this: MpdsWorld) {
    const body = this.lastResult as Record<string, unknown> | null;
    assert.ok(body !== null && typeof body === 'object', 'Expected a JSON-RPC response object');
    const result = body['result'];
    assert.strictEqual(
      typeof result,
      'string',
      `Expected result to be a raw HTML string, got ${typeof result}`
    );
    assert.ok(
      (result as string).trimStart().startsWith('<!DOCTYPE'),
      `Expected raw HTML to start with <!DOCTYPE, got: ${(result as string).slice(0, 40)}`
    );
  }
);
